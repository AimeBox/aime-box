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
import { pathToFileURL } from 'url';
import { cn } from '@/lib/utils';

interface ProviderIconProps {
  provider: string;
  size?: number | null;
  className?: string | null;
}
const logos = {
  tongyi: tongyiIcon,
  ollama: ollamaIcon,
  anthropic: anthropicIcon,
  zhipu: zhipuIcon,
  openai: openaiIcon,
  groq: groqIcon,
  openrouter: openrouterIcon,
  siliconflow: siliconflowIcon,
  google: googleIcon,
  deepseek: deepseekIcon,
  togetherai: togetheraiIcon,
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
