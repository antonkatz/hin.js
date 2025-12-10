import Benchmark from 'benchmark';
import {group, hinj} from "../hinj.mjs";
import Bench from "tinybench";

const bench = new Bench({time: 500, warmupTime: 100})

function get(T) {
  return T.value
}

const C = group(null, {
  result: hinj()
})

const vc = {value: 1}
const c = C()
C.result(c, 1)


// add tests
bench
    .add('vanilla get', function() {
      return vc.value
    })
    .add('vanilla getter', function () {
      return get(vc)
    })
    .add('hinge', function () {
      return C.result(c)
      // C.doOp(c, 1)
    })


main()

async function main() {

  await bench.warmup(); // make results more reliable, ref: https://github.com/tinylibs/tinybench/pull/50
  await bench.run();

  console.table(bench.table());
}