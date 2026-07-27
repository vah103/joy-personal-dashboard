const diagnosticBandBeforeWritingFreshness = diagnosticBand;
diagnosticBand = function diagnosticBandWithWritingFreshness(skill) {
  if (skill === "writing") {
    const diagnostic = app.data.diagnostics?.writing;
    if (diagnostic?.review && !writingReviewFresh(diagnostic)) return null;
  }
  return diagnosticBandBeforeWritingFreshness(skill);
};
