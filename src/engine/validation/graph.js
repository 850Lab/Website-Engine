export const VALIDATOR_GRAPH = [
  { phase: "0.5", script: "validate-phase-0-5.js", dependsOn: [] },
  { phase: "1", script: "validate-phase-1.js", dependsOn: ["0.5"] },
  { phase: "2.1", script: "validate-phase-2-1.js", dependsOn: ["1"] },
  { phase: "2.2", script: "validate-phase-2-2.js", dependsOn: ["2.1"] },
  { phase: "2.2.5", script: "validate-phase-2-2-5.js", dependsOn: ["2.2"] },
  { phase: "2.3", script: "validate-phase-2-3.js", dependsOn: ["2.2.5"] },
  { phase: "2.4", script: "validate-phase-2-4.js", dependsOn: ["2.3"] },
  { phase: "2.5", script: "validate-phase-2-5.js", dependsOn: ["2.4"] },
  { phase: "2.5.5", script: "validate-phase-2-5-5.js", dependsOn: ["2.5", "2.4"] },
  { phase: "2.6", script: "validate-phase-2-6.js", dependsOn: ["2.5.5", "2.5", "2.4"] },
  { phase: "2.7", script: "validate-phase-2-7.js", dependsOn: ["2.6", "2.5.5"] },
  { phase: "2.8", script: "validate-phase-2-8.js", dependsOn: ["2.7"] },
  { phase: "2.9", script: "validate-phase-2-9.js", dependsOn: ["2.8", "2.7", "2.6", "2.5.5"] },
  { phase: "2.9.5", script: "validate-phase-2-9-5.js", dependsOn: ["2.9"] },
  { phase: "3.1", script: "validate-phase-3-1.js", dependsOn: ["2.9.5"] },
  { phase: "3.1.7", script: "validate-phase-3-1-7.js", dependsOn: ["3.1"] },
  { phase: "3.1.7.5", script: "validate-phase-3-1-7-5.js", dependsOn: ["3.1.7", "3.1"] },
  { phase: "3.1.8", script: "validate-phase-3-1-8.js", dependsOn: ["3.1.7.5", "3.1"] },
  { phase: "3.2", script: "validate-phase-3-2.js", dependsOn: ["3.1", "2.9.5"] },
  { phase: "3.3", script: "validate-phase-3-3.js", dependsOn: ["3.2", "3.1.8", "2.9.5"] },
  { phase: "3.4", script: "validate-phase-3-4.js", dependsOn: ["3.3", "3.2", "3.1.8"] },
  { phase: "3.5", script: "validate-phase-3-5.js", dependsOn: ["3.4", "3.3", "3.2"] },
  { phase: "3.6", script: "validate-phase-3-6.js", dependsOn: ["3.5", "3.4", "3.3", "3.2", "3.1"] },
  { phase: "3.7", script: "validate-phase-3-7.js", dependsOn: ["3.6", "3.5", "3.4", "3.3", "3.2", "3.1"] },
  { phase: "3.8", script: "validate-phase-3-8.js", dependsOn: ["3.7", "3.6", "3.5", "3.4", "3.3", "3.2", "3.1"] },
  { phase: "4.0", script: "validate-phase-4-0.js", dependsOn: ["3.8", "3.7", "3.6"] },
  { phase: "4.0.6", script: "validate-phase-4-0-6.js", dependsOn: ["4.0"] },
  { phase: "4.1", script: "validate-phase-4-1.js", dependsOn: ["4.0.6"] },
];

export function getValidatorByPhase(phase) {
  return VALIDATOR_GRAPH.find((row) => row.phase === phase);
}

export function getValidatorByScript(script) {
  const normalized = script.endsWith(".js") ? script : `${script}.js`;
  return VALIDATOR_GRAPH.find((row) => row.script === normalized);
}

export function resolveExecutionOrder(phases = null) {
  let targetPhases = phases;
  if (phases?.length) {
    const required = new Set(phases);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const node of VALIDATOR_GRAPH) {
        if (!required.has(node.phase)) continue;
        for (const dep of node.dependsOn) {
          if (!required.has(dep)) {
            required.add(dep);
            expanded = true;
          }
        }
      }
    }
    targetPhases = [...required];
  }

  const selected = targetPhases?.length
    ? VALIDATOR_GRAPH.filter((row) => targetPhases.includes(row.phase))
    : VALIDATOR_GRAPH;
  const selectedSet = new Set(selected.map((row) => row.phase));
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(node) {
    if (visited.has(node.phase)) return;
    if (visiting.has(node.phase)) {
      throw new Error(`Validator dependency cycle detected at phase ${node.phase}`);
    }
    visiting.add(node.phase);
    for (const dep of node.dependsOn) {
      const depNode = getValidatorByPhase(dep);
      if (!depNode) continue;
      if (selectedSet.has(dep)) {
        visit(depNode);
      }
    }
    visiting.delete(node.phase);
    visited.add(node.phase);
    ordered.push(node);
  }

  for (const node of selected) {
    visit(node);
  }

  const seen = new Set();
  return ordered.filter((node) => {
    if (seen.has(node.phase)) return false;
    seen.add(node.phase);
    return true;
  });
}

export function getBlockedPhases(rootFailurePhase) {
  const rootIndex = VALIDATOR_GRAPH.findIndex((row) => row.phase === rootFailurePhase);
  if (rootIndex < 0) return [];
  return VALIDATOR_GRAPH.slice(rootIndex + 1).map((row) => row.phase);
}
