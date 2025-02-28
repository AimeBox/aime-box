import path from 'path';
import sherpa_onnx from 'sherpa-onnx-node';
import { parentPort, isMainThread, threadId } from 'worker_threads';

console.debug('[工作线程] 启动 创建成功');
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
  console.log(`[主线程]`);
  if (OfflineTts == null) {
    createTts();
  }
  const speakerId = 0;
  const speed = 1.0;
  console.debug(`[工作线程] tts 创建成功`);
  const audio = OfflineTts?.generate({
    text: '123123123213asd',
    sid: speakerId,
    speed: speed,
  });
} else {
  parentPort.on('message', async (message) => {
    try {
      console.debug(
        `[工作线程] 收到主线程消息: ${JSON.stringify(message.config)}`,
      );
      if (OfflineTts == null) {
        console.debug(`[工作线程] 创建TTS引擎`);
        createTts(message.config);
      }
      const speakerId = message.sid || 0;
      const speed = message.speed || 1.0;
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
