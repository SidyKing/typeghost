// TypeGhost example — play me with "TypeGhost: Play From File…"
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
//~ pause 800

//~ checkpoint explain-recursion
const series = [];
for (let i = 0; i < 10; i++) {
  series.push(fibonacci(i));
}

console.log(series.join(", "));
