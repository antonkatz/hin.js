import Benchmark from 'benchmark';
import {group, hinj} from "../hinj.mjs";

const suite = new Benchmark.Suite;

function doOp(T, args) {
  Math.random() + args
}

const C = group(null, {
  doOp: hinj()
      .sync(doOp)
})

const vc = {}
const c = C()

// add tests
suite
    .add('vanilla function', function () {
      doOp(vc, 10)
    })
    .add('hinge', function () {
      C.doOp(c, 10)
    })
    // add listeners
    .on('cycle', function (event) {
      console.log(String(event.target));
    })
    .on('complete', function () {
      console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    // run async
    .run();