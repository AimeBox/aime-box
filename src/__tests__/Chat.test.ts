import { ChatOpenAI } from "@langchain/openai";
import {z} from 'zod';

const main = async ()=>{
  const llm = new ChatOpenAI({
    apiKey:'NULL',
    modelName: "chat-v3",
    configuration: {
      apiKey: "NULL",
      baseURL: "http://127.0.0.1:3000/v1",
    }
  });
  const wll = llm.withStructuredOutput(z.object({
    time: z.string()
  }))
  const res = await wll.invoke("Hello,now date time is 2025-12-12 10:45:22");
  console.log(res)
  debugger;
}





main()