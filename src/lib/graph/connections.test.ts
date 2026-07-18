import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalResourcePair,
  rankConnectionCandidates,
  sanitizeTopicNames,
} from "./connections.ts";

test("sanitizeTopicNames removes placeholders and case-insensitive duplicates", () => {
  assert.deepEqual(
    sanitizeTopicNames([" React ", "Test Topic", "react", "State  Management "]),
    ["React", "State Management"]
  );
});

test("canonicalResourcePair returns a stable undirected pair", () => {
  assert.deepEqual(canonicalResourcePair("resource-b", "resource-a"), [
    "resource-a",
    "resource-b",
  ]);
});

test("rankConnectionCandidates prioritizes specific content over a broad shared topic", () => {
  const candidates = [
    {
      id: "react-state",
      title: "Managing React state with useState",
      summary: "Component state, updater functions, and hooks.",
      topics: ["React", "Frontend"],
    },
    {
      id: "css-layout",
      title: "Modern CSS grid layouts",
      summary: "Responsive page layout techniques.",
      topics: ["Frontend"],
    },
    ...Array.from({ length: 18 }, (_, index) => ({
      id: `unrelated-${index}`,
      title: `Database indexing guide ${index}`,
      summary: "Query plans and relational database performance.",
      topics: ["Engineering"],
    })),
  ];

  const ranked = rankConnectionCandidates(
    {
      id: "new",
      title: "React useState hook reference",
      summary: "How updater functions change component state.",
      topics: ["React", "Frontend"],
    },
    candidates,
    3
  );

  assert.equal(ranked[0]?.id, "react-state");
  assert.ok(ranked.some((candidate) => candidate.id !== "css-layout"));
});
