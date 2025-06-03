import { ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import Replicate from "replicate";

export interface ReplicateParameters extends ToolParams {
  apiKey: string;
}
const REPLICATE_API_URL = 'https://api.replicate.com/v1';
const REPLICATE_OFFICIAL_LINK = 'https://replicate.com/account/keys';