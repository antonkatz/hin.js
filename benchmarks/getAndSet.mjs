import Benchmark from 'benchmark';
import {group, hinj} from "../hinj.mjs";
import Bench from "tinybench";

// const suite = new Benchmark.Suite;
const bench = new Bench({time: 1000, warmupTime: 500})

function get(T) {
  return T.value
}

function set(T, args) {
  T.value = args
}

const C = group(null, {
  doOp: hinj()
      .sync((T, args) => C.result(T, C.result(T) + args)),
  result: hinj()
})

const vc = {}
const c = C()
const cdo = C.doOp

// add tests
bench
    .add('vanilla set', function () {
      const v = vc.value
      vc.value = v + 1
    })
    .add('vanilla getter/setter', function () {
      set(vc, get(vc) + 1)
    })
    .add('hinge', function () {
      cdo(c, 1)
      // C.doOp(c, 1)
    })

    // run async

main()

async function main() {

  await bench.warmup(); // make results more reliable, ref: https://github.com/tinylibs/tinybench/pull/50
  await bench.run();

  console.table(bench.table());
}