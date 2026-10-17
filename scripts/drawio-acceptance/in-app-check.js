/* global window, EditorUi, mxStencilRegistry, mxCellRenderer -- browser console script for app.diagrams.net */
// Paste into the browser devtools console of app.diagrams.net AFTER opening a file, then click
// another page tab once (that call captures the editor). Run `iacvizCheck()` afterwards.
// It inspects the live diagrams.net model on every page; it changes nothing.
(() => {
  const select = EditorUi.prototype.selectPage;
  EditorUi.prototype.selectPage = function (...args) {
    window.__iacvizUi = this;
    return select.apply(this, args);
  };
  window.iacvizCheck = () => {
    const ui = window.__iacvizUi;
    if (!ui) return "Click another page tab first.";
    const report = [];
    for (const page of ui.pages) {
      ui.selectPage(page);
      const graph = ui.editor.graph;
      const cells = Object.values(graph.getModel().cells);
      const vertices = cells.filter((c) => c.vertex);
      const edges = cells.filter((c) => c.edge);
      const styles = vertices.map((c) => c.style || "");
      const shapes = [
        ...new Set(
          styles.flatMap((s) =>
            [/resIcon=([^;]+)/, /shape=(mxgraph\.aws4\.[^;]+)/, /grIcon=([^;]+)/]
              .map((re) => re.exec(s)?.[1])
              .filter(Boolean),
          ),
        ),
      ];
      const resources = vertices.filter((c) => c.value?.getAttribute?.("resource_type"));
      const box = (c) => graph.view.getState(c);
      const cards = resources.filter((c) => !/container=1/.test(c.style));
      let overlaps = 0;
      for (let i = 0; i < cards.length; i++)
        for (let j = i + 1; j < cards.length; j++) {
          if (cards[i].parent !== cards[j].parent) continue;
          const p = box(cards[i]);
          const q = box(cards[j]);
          if (
            p &&
            q &&
            p.x < q.x + q.width - 1 &&
            q.x < p.x + p.width - 1 &&
            p.y < q.y + q.height - 1 &&
            q.y < p.y + p.height - 1
          )
            overlaps++;
        }
      report.push({
        page: page.getName(),
        vertices: vertices.length,
        edges: edges.length,
        danglingEdges: edges.filter((c) => !c.source || !c.target).length,
        resources: resources.length,
        withTerraformAddress: resources.filter((c) => c.value.getAttribute("terraform_address")).length,
        missingShapes: shapes.filter(
          (s) => !mxStencilRegistry.getStencil(s) && !mxCellRenderer.defaultShapes[s],
        ),
        lockedCells: vertices.filter((c) => !graph.isCellMovable(c) || !graph.isCellEditable(c)).length,
        imageCells: styles.filter((s) => /image=/.test(s)).length,
        overlappingSiblingCards: overlaps,
      });
    }
    const saved = ui.getFileData(true, null, null, null, true, false);
    report.push({
      savedPages: (saved.match(/<diagram /g) || []).length,
      savedKeepsMetadata: saved.includes("terraform_address="),
    });
    return report;
  };
  return "Ready: click another page tab, then run iacvizCheck()";
})();
