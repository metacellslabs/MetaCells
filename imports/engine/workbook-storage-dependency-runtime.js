import {
  deepClone,
  isPlainObject,
  makeDependencyGraphKey,
} from './workbook-storage-core.js';

export function installWorkbookStorageDependencyMethods(WorkbookStorageAdapter) {
  Object.assign(WorkbookStorageAdapter.prototype, {
    ensureDependencyGraph() {
      if (!isPlainObject(this.workbook.dependencyGraph)) {
        this.workbook.dependencyGraph = {
          byCell: {},
          dependentsByCell: {},
          dependentsByNamedRef: {},
          dependentsByChannel: {},
          dependentsByAttachment: {},
          meta: {
            authoritative: false,
            version: 1,
            repairedAt: '',
          },
        };
      }
      if (!isPlainObject(this.workbook.dependencyGraph.byCell)) {
        this.workbook.dependencyGraph.byCell = {};
      }
      if (!isPlainObject(this.workbook.dependencyGraph.dependentsByCell)) {
        this.workbook.dependencyGraph.dependentsByCell = {};
      }
      if (!isPlainObject(this.workbook.dependencyGraph.dependentsByNamedRef)) {
        this.workbook.dependencyGraph.dependentsByNamedRef = {};
      }
      if (!isPlainObject(this.workbook.dependencyGraph.dependentsByChannel)) {
        this.workbook.dependencyGraph.dependentsByChannel = {};
      }
      if (!isPlainObject(this.workbook.dependencyGraph.dependentsByAttachment)) {
        this.workbook.dependencyGraph.dependentsByAttachment = {};
      }
      if (!isPlainObject(this.workbook.dependencyGraph.meta)) {
        this.workbook.dependencyGraph.meta = {
          authoritative: false,
          version: 1,
          repairedAt: '',
        };
      }
      return this.workbook.dependencyGraph;
    },

    markDependencyGraphAuthoritative(authoritative, reason) {
      var graph = this.ensureDependencyGraph();
      graph.meta = {
        authoritative: authoritative !== false,
        version: Number(graph.meta && graph.meta.version) || 1,
        repairedAt:
          authoritative !== false
            ? new Date().toISOString()
            : String((graph.meta && graph.meta.repairedAt) || ''),
        reason: String(reason || ''),
      };
    },

    rebuildReverseDependencyGraph() {
      var graph = this.ensureDependencyGraph();
      var dependentsByCell = {};
      var dependentsByNamedRef = {};
      var dependentsByChannel = {};
      var dependentsByAttachment = {};
      var register = function (bucket, key, sourceKey) {
        var normalizedKey = String(key || '');
        var normalizedSourceKey = String(sourceKey || '');
        if (!normalizedKey || !normalizedSourceKey) return;
        if (!Array.isArray(bucket[normalizedKey])) bucket[normalizedKey] = [];
        if (bucket[normalizedKey].indexOf(normalizedSourceKey) === -1) {
          bucket[normalizedKey].push(normalizedSourceKey);
        }
      };

      Object.keys(graph.byCell).forEach(function (sourceKey) {
        var entry = isPlainObject(graph.byCell[sourceKey])
          ? graph.byCell[sourceKey]
          : {};

        (Array.isArray(entry.cells) ? entry.cells : []).forEach(function (item) {
          if (!item || typeof item !== 'object') return;
          register(
            dependentsByCell,
            makeDependencyGraphKey(item.sheetId, item.cellId),
            sourceKey,
          );
        });

        (Array.isArray(entry.namedRefs) ? entry.namedRefs : []).forEach(
          function (name) {
            register(dependentsByNamedRef, String(name || '').trim(), sourceKey);
          },
        );

        (Array.isArray(entry.channelLabels) ? entry.channelLabels : []).forEach(
          function (label) {
            register(dependentsByChannel, String(label || '').trim(), sourceKey);
          },
        );

        (Array.isArray(entry.attachments) ? entry.attachments : []).forEach(
          function (item) {
            if (!item || typeof item !== 'object') return;
            register(
              dependentsByAttachment,
              makeDependencyGraphKey(item.sheetId, item.cellId),
              sourceKey,
            );
          },
        );
      });

      graph.dependentsByCell = dependentsByCell;
      graph.dependentsByNamedRef = dependentsByNamedRef;
      graph.dependentsByChannel = dependentsByChannel;
      graph.dependentsByAttachment = dependentsByAttachment;
      return graph;
    },

    getCellDependencies(sheetId, cellId) {
      var graph = this.ensureDependencyGraph();
      var key = makeDependencyGraphKey(sheetId, cellId);
      var entry = isPlainObject(graph.byCell[key]) ? graph.byCell[key] : null;
      if (!entry) {
        return {
          cells: [],
          namedRefs: [],
          channelLabels: [],
          attachments: [],
        };
      }
      return deepClone(entry);
    },

    setCellDependencies(sheetId, cellId, dependencies) {
      var graph = this.ensureDependencyGraph();
      var key = makeDependencyGraphKey(sheetId, cellId);
      var entry = isPlainObject(dependencies) ? deepClone(dependencies) : {};
      graph.byCell[key] = {
        cells: Array.isArray(entry.cells) ? entry.cells : [],
        namedRefs: Array.isArray(entry.namedRefs) ? entry.namedRefs : [],
        channelLabels: Array.isArray(entry.channelLabels)
          ? entry.channelLabels
          : [],
        attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
      };
      this.rebuildReverseDependencyGraph();
    },

    clearCellDependencies(sheetId, cellId) {
      var graph = this.ensureDependencyGraph();
      delete graph.byCell[makeDependencyGraphKey(sheetId, cellId)];
      this.rebuildReverseDependencyGraph();
      this.markDependencyGraphAuthoritative(false, 'source-changed');
    },

    getDependencyGraph() {
      return deepClone(this.ensureDependencyGraph());
    },

    isDependencyGraphAuthoritative() {
      var graph = this.ensureDependencyGraph();
      return !!(graph.meta && graph.meta.authoritative === true);
    },
  });
}
