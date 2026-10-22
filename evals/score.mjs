// Scores suggested answers against evals/suggestions.json.
// A case lists every answer a careful reviewer would accept; null means "no suggestion".

export function score(cases, results) {
  const rows = cases.map((c, i) => {
    const got = results[i];
    if (got && typeof got === "object") return { ...c, got: "error", outcome: "error" };
    let outcome;
    if (c.accept.includes(got)) outcome = "correct";
    else if (got === null) outcome = "abstained";
    // The costly mistake: suggesting No when the seller described a problem or was unsure.
    else if (got === "no") outcome = "dangerous-no";
    else outcome = "wrong";
    return { ...c, got, outcome };
  });
  const count = (o) => rows.filter((r) => r.outcome === o).length;
  return {
    rows,
    total: rows.length,
    correct: count("correct"),
    abstained: count("abstained"),
    wrong: count("wrong"),
    dangerousNo: count("dangerous-no"),
    errors: count("error"),
  };
}

export function printReport(label, s) {
  const pct = ((s.correct / s.total) * 100).toFixed(1);
  console.log(`\n${label}: ${s.correct}/${s.total} correct (${pct}%)`);
  console.log(
    `  no suggestion: ${s.abstained}   wrong: ${s.wrong}   wrong "No": ${s.dangerousNo}   errors: ${s.errors}`,
  );
  for (const r of s.rows.filter((row) => row.outcome !== "correct")) {
    const expected = r.accept.map((a) => a ?? "none").join(" or ");
    console.log(`  [${r.outcome}] ${r.question}: "${r.answer}" -> ${r.got ?? "none"} (expected ${expected})`);
  }
}
