import { Command, interrupt, MessagesAnnotation } from '@langchain/langgraph';

const HumanNode = (state: typeof MessagesAnnotation.State) => {
  const value = interrupt({
    text_to_revise: state.messages[state.messages.length - 1].text,
  });
  return new Command({
    update: {
      messages: [...state.messages, value],
    },
    goto: 'manus',
  });
};
