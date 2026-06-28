export function rankEligibleJobs(jobs = []) {
  return [...jobs].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}
