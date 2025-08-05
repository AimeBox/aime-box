import React from 'react';

import ollamaIcon from '../../../../assets/model-logos/ollama.png';
import tongyiIcon from '../../../../assets/model-logos/tongyi.png';
import anthropicIcon from '../../../../assets/model-logos/anthropic.png';
import zhipuIcon from '../../../../assets/model-logos/zhipu.png';
import openaiIcon from '../../../../assets/model-logos/openai.png';
import groqIcon from '../../../../assets/model-logos/groq.png';
import openrouterIcon from '../../../../assets/model-logos/openrouter.png';
import siliconflowIcon from '../../../../assets/model-logos/siliconflow.png';
import googleIcon from '../../../../assets/model-logos/google.png';
import deepseekIcon from '../../../../assets/model-logos/deepseek.png';
import togetheraiIcon from '../../../../assets/model-logos/togetherai.png';
import baiduIcon from '../../../../assets/model-logos/baidu.png';
import lmstudioIcon from '../../../../assets/model-logos/lmstudio.png';
import azureOpenaiIcon from '../../../../assets/model-logos/azure_openai.png';
import volcanoEngineIcon from '../../../../assets/model-logos/volcanoengine.png';
import minimaxIcon from '../../../../assets/model-logos/minimax.png';
import replicateIcon from '../../../../assets/model-logos/replicate.png';
import elevenlabsIcon from '../../../../assets/model-logos/elevenlabs.png';
import moonshotIcon from '../../../../assets/model-logos/moonshot.png';
import bigmodelIcon from '../../../../assets/model-logos/bigmodel.png';

import { pathToFileURL } from 'url';
import { cn } from '@/lib/utils';

interface ProviderIconProps {
  provider: string;
  size?: number | string | null;
  className?: string | null;
}
const logos = {
  tongyi: tongyiIcon,
  ollama: ollamaIcon,
  anthropic: anthropicIcon,
  baidu: baiduIcon,
  zhipu: zhipuIcon,
  openai: openaiIcon,
  groq: groqIcon,
  openrouter: openrouterIcon,
  siliconflow: siliconflowIcon,
  google: googleIcon,
  deepseek: deepseekIcon,
  togetherai: togetheraiIcon,
  lmstudio: lmstudioIcon,
  azure_openai: azureOpenaiIcon,
  volcanoengine: volcanoEngineIcon,
  minimax: minimaxIcon,
  replicate: replicateIcon,
  elevenlabs: elevenlabsIcon,
  moonshot: moonshotIcon,
  bigmodel: bigmodelIcon,
};
// eslint-disable-next-line react/function-component-definition
const ProviderIcon: React.FC<ProviderIconProps> = ({
  provider,
  size = 24,
  className = '',
}) => {
  const iconProps = {
    size,
    className,
  };

  // const logos = {};
  // Object.keys(logos).forEach((key) => {
  //   logos[key] = tongyiIcon;
  // });

  return (
    <div>
      <img
        src={logos[provider]}
        alt={provider}
        className={cn(className, `h-full`)}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    </div>
  );
  // switch (provider) {
  //   case ProviderType.GOOGLE:
  //     return <img src={tongyiIcon} alt={''} className="h-full" />;

  //   default:
  //     return null;
  // }
};

export default ProviderIcon;
