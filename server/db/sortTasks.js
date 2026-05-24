/** Kolejność stosu: bez daty na górze, potem rosnąco po dacie wykonania. */
function sortActiveTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const aNo = !a.due_date;
    const bNo = !b.due_date;
    if (aNo !== bNo) return aNo ? -1 : 1;
    if (aNo && bNo) {
      return (b.stack_position ?? 0) - (a.stack_position ?? 0) || b.id - a.id;
    }
    const ad = new Date(a.due_date).getTime();
    const bd = new Date(b.due_date).getTime();
    if (ad !== bd) return ad - bd;
    return b.id - a.id;
  });
}

module.exports = { sortActiveTasks };
