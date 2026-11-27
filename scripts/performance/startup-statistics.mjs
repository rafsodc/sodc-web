const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// Failures remain in the raw report. Only matching successful pair IDs may
// contribute a paired difference; a missing counterpart must never shift rows.
export function summarizeStartupSamples(samples, profiles, journeys) {
  const summary = [];
  for (const profile of profiles) for (const journey of journeys) {
    const passed = samples.filter(sample => sample.profile === profile && sample.journey === journey && sample.status === 'passed');
    const variants = { baseline: new Map(), candidate: new Map() };
    for (const sample of passed) {
      if (!Object.hasOwn(variants, sample.variant) || !Number.isInteger(sample.pair) || sample.pair < 1) throw new Error('invalid-measurement-pair');
      if (variants[sample.variant].has(sample.pair)) throw new Error('duplicate-measurement-pair');
      variants[sample.variant].set(sample.pair, sample);
    }
    const names = [...new Set(passed.flatMap(sample => sample.steps.map(step => step.name)))];
    for (const name of names) {
      const values = Object.fromEntries(Object.entries(variants).map(([variant, entries]) => [variant, new Map([...entries].map(([pair, sample]) => {
        const steps = sample.steps.filter(step => step.name === name);
        if (steps.length !== 1 || !Number.isFinite(steps[0].durationMs) || steps[0].durationMs < 0) throw new Error('invalid-passed-measurement-step');
        return [pair, steps[0].durationMs];
      }))]));
      const pairedPairIds = [...values.baseline.keys()].filter(pair => values.candidate.has(pair)).sort((a, b) => a - b);
      const differences = pairedPairIds.map(pair => values.candidate.get(pair) - values.baseline.get(pair));
      summary.push({ profile, journey, step: name,
        baselineMedianMs: median([...values.baseline.values()]), candidateMedianMs: median([...values.candidate.values()]),
        baselineSamples: values.baseline.size, candidateSamples: values.candidate.size,
        pairedSamples: pairedPairIds.length, pairedPairIds,
        unmatchedPairs: {
          baseline: [...values.baseline.keys()].filter(pair => !values.candidate.has(pair)).sort((a, b) => a - b),
          candidate: [...values.candidate.keys()].filter(pair => !values.baseline.has(pair)).sort((a, b) => a - b),
        },
        pairedDifferenceMedianMs: median(differences), pairedDifferencesMs: differences });
    }
  }
  return summary;
}
