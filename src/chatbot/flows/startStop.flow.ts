import { addKeyword } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";

const secretPhraseFlow = addKeyword<Provider, Database>("stop bot").addAction(
  async (ctx, { blacklist, flowDynamic }) => {
    const check = blacklist.checkIf(ctx.from);
    if (!check) {
      blacklist.add(ctx.from);
      console.log(ctx.from);
      await flowDynamic(
        `🤖 Hemos pausado las respuestas. Un humano lo atendera en un segundo.`
      );
      return;
    }
  }
);

export { secretPhraseFlow };
