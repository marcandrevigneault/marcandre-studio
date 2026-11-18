import { pageDocumentSchema, type PageId, type PageDocument } from './page-builder-schema';
import { defaultPage } from './page-builder-defaults';
const published=import.meta.glob('../content/pages/*.json',{eager:true,query:'?raw',import:'default'}) as Record<string,string>;
export function publishedPage(id:PageId):PageDocument {
 const raw=published[`../content/pages/${id}.json`];
 return raw ? pageDocumentSchema.parse(JSON.parse(raw)) : defaultPage(id);
}
