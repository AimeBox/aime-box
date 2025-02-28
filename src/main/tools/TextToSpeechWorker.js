const path = require('path');
const sherpa_onnx = require('sherpa-onnx-node');
const { parentPort, isMainThread, threadId } = require('worker_threads');

console.debug('[工作线程] 启动 创建成功阿萨达');
let OfflineTts = null;

function createTts(config = null) {
  let _config = null;
  const model = 'vits-melo-tts-zh_en';
  if (config == null) {
    const phoneFst = path.join(
      __dirname,
      '../../../models/tts',
      `${model}/phone.fst`,
    );
    const dateFst = path.join(
      __dirname,
      '../../../models/tts',
      `${model}/date.fst`,
    );
    const numberFst = path.join(
      __dirname,
      '../../../models/tts',
      `${model}/number.fst`,
    );
    const new_heteronymFst = path.join(
      __dirname,
      '../../../models/tts',
      `${model}/new_heteronym.fst`,
    );
    _config = {
      model: {
        vits: {
          model: path.join(
            __dirname,
            `../../../models/tts/${model}/model.onnx`,
          ),
          tokens: path.join(
            __dirname,
            `../../../models/tts/${model}/tokens.txt`,
          ),
          lexicon: path.join(
            __dirname,
            `../../../models/tts/${model}/lexicon.txt`,
          ),
          dictDir: path.join(__dirname, `../../../models/tts/${model}/dict`),
        },
        debug: true,
        numThreads: 1,
        provider: 'cpu',
      },
      maxNumStences: 1,
      ruleFsts: `${phoneFst},${dateFst},${numberFst},${new_heteronymFst}`,

      // ruleFars: '../../models/tts/vits-melo-tts-zh_en/rule.far',
    };
  } else {
    _config = config;
  }
  console.debug(_config);
  OfflineTts = new sherpa_onnx.OfflineTts(_config);
}

if (isMainThread) {
  // console.log(`[主线程]`);
  // if (OfflineTts == null) {
  //   createTts();
  // }
  // const speakerId = 0;
  // const speed = 1.0;
  // console.debug(`[工作线程] tts 创建成功`);
  // const audio = OfflineTts?.generate({
  //   text: '123123123213asd',
  //   sid: speakerId,
  //   speed: speed,
  // });
} else {
  parentPort.on('message', async (message) => {
    try {
      console.debug(
        `[工作线程] 收到主线程消息: ${JSON.stringify(message.config)}`,
      );
      //const tts = this.OfflineTts;
      // const tts = new sherpa_onnx.OfflineTts(message.config);
      //const tts = createTts(message.config);
      if (OfflineTts == null) {
        console.debug(`[工作线程] 创建TTS引擎`);
        createTts(message.config);
      }
      const speakerId = message.sid || 0;
      const speed = 1.0;
      console.debug(`[工作线程] tts 创建成功`);
      const audio = OfflineTts?.generate({
        text: message.text,
        sid: speakerId,
        speed: speed,
        enableExternalBuffer: false,
      });
      console.debug(`[工作线程] audio 创建成功`);
      parentPort.postMessage(audio);
    } catch (err) {
      console.debug(`[工作线程] ${err}`);
      parentPort.postMessage(err);
    }
  });
}

// const text =
//   '他在长沙出生，长白山长大，去过长江，现在他是一个银行的行长，主管行政工作。有困难，请拨110，或者13020240513。今天是2024年5月13号, 他上个月的工资是12345块钱。';

// const start: number = Date.now();
// const audio = tts.generate({ text: text, sid: 88, speed: 1.0 });
// const stop2: number = Date.now();
// const elapsed_seconds = (stop2 - start) / 1000;
// const duration = audio.samples.length / audio.sampleRate;
// const real_time_factor = elapsed_seconds / duration;
// console.log('Wave duration', duration.toFixed(3), 'secodns');
// console.log('Elapsed', elapsed_seconds.toFixed(3), 'secodns');
// console.log(
//   `RTF = ${elapsed_seconds.toFixed(3)}/${duration.toFixed(3)} =`,
//   real_time_factor.toFixed(3),
// );

// const filename = 'test-zh-aishell3.wav';
// sherpa_onnx.writeWave(filename, {
//   samples: audio.samples,
//   sampleRate: audio.sampleRate,
// });

// console.log(`Saved to ${filename}`);
