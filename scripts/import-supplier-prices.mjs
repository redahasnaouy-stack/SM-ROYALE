import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=JSON.parse(await readFile('catalogue/supplier-prices-2026-10-22.json','utf8'));
const products=JSON.parse(await readFile('public/products.json','utf8')).filter(p=>!(p.id.startsWith('SUP-')&&p.priceSource?.sourceFile===source.sourceFile));
for(const p of products)if(p.priceEstimate){p.variants=[];delete p.priceEstimate;delete p.estimateBasis;}
const map=new Map(products.map(p=>[p.id,p]));
const reviewed=source.groups.filter(g=>!g.requiresReview),pending=source.groups.filter(g=>g.requiresReview);
const variants=g=>g.variants.filter(v=>v.priceCents!==null).map(v=>({key:v.key,size:v.size,price:v.priceCents/100,cartonQuantity:v.cartonQuantity,supplierReference:v.supplierReference,sourceGroup:g.id}));
function apply(product,group,values=variants(group)){
  product.variants=values;if(values.length)delete product.priceReviewRequired;product.pricingRevision=source.revision+'-'+createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0,16);product.priceSource={group:group.id,sheet:group.sheet,sourceFile:source.sourceFile};
}
const mapped=[];
for(const group of reviewed){
  const values=variants(group);
  if(group.matchedProductIds.length){
    for(const id of group.matchedProductIds){const product=map.get(id);if(!product)throw new Error('Unknown image reference '+id);apply(product,group,values);mapped.push({id,group:group.id});}
  }else if(values.length){
    const id='SUP-'+group.id;let product=map.get(id);
    if(!product){product={id,name:group.name,category:group.category,image:'./images/logo-transparent.png',photoPlaceholder:true,variants:[]};products.push(product);map.set(id,product);}
    product.name=group.name;apply(product,group,values);
  }
}
// No previous guessed price is retained for a model whose duplicate source label is unresolved.
for(const group of pending)for(const id of group.matchedProductIds){const product=map.get(id);apply(product,group,[]);product.priceReviewRequired=true;}
// Capacity-specific photos use the matching source row, rather than all capacities in a family.
const goldPerfume=source.groups.find(g=>g.id==='S03-G13');apply(map.get('SMR-047'),goldPerfume,variants(goldPerfume).filter(v=>v.size==='12 ml'));
// Preserve a model's single pictured capacity when the matching list contains several models.
for(const [id,size]of [['SMR-020','50 ml'],['SMR-102','100 ml / carton A'],['SMR-130','250 ml / carton'],['SMR-059','125 ml'],['SMR-106','30 ml']]){
 const p=map.get(id),g=source.groups.find(g=>g.id===p.priceSource.group);apply(p,g,variants(g).filter(v=>v.size===size));
}
// Keep every readable source price available, including packaging variants
// not shown by the capacity-specific photographs above.
const usedKeys=new Set(products.flatMap(p=>p.variants.map(v=>v.key)));
for(const group of reviewed){
 const missing=variants(group).filter(v=>!usedKeys.has(v.key));if(!missing.length)continue;
 const id='SUP-'+group.id;let product=map.get(id);
 if(!product){product={id,name:group.name,category:group.category,image:'./images/logo-transparent.png',photoPlaceholder:true,variants:[]};products.push(product);map.set(id,product);}
 apply(product,group,missing);missing.forEach(v=>usedKeys.add(v.key));
}
const estimates=JSON.parse(await readFile('catalogue/estimated-prices-2026-10-24.json','utf8'));
for(const entry of estimates.products){
 const product=map.get(entry.productId);if(!product)throw new Error('Unknown estimate product '+entry.productId);
 if(product.variants.length)continue; // A confirmed source price always wins.
 product.variants=entry.variants.map((v,i)=>({key:'EST-'+entry.productId+'-'+i,size:v.size,price:v.priceCents/100,estimated:true}));
 product.priceEstimate=true;product.estimateBasis={referenceProductId:entry.referenceProductId,basis:entry.basis};delete product.priceReviewRequired;delete product.priceSource;
 product.pricingRevision=estimates.revision+'-'+createHash('sha256').update(JSON.stringify(product.variants)).digest('hex').slice(0,16);
}
const report={revision:source.revision,sourceSha256:source.sourceSha256,sourceGroups:source.groups.length,sourceVariants:source.groups.reduce((n,g)=>n+g.variants.length,0),pricedSourceRows:reviewed.reduce((n,g)=>n+variants(g).length,0),blankSourceRows:source.groups.flatMap(g=>g.variants.filter(v=>v.priceCents===null).map(v=>({group:g.id,...v}))),pendingGroups:pending,mappedImageProducts:mapped,totalProducts:products.length,estimatedProducts:products.filter(p=>p.priceEstimate).length,pricedProducts:products.filter(p=>p.variants.length).length,pricedVariants:products.reduce((n,p)=>n+p.variants.length,0)};
await writeFile('public/products.json',JSON.stringify(products,null,2)+'\n');
await mkdir('docs',{recursive:true});await writeFile('docs/price-import-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({products:report.totalProducts,pricedProducts:report.pricedProducts,pricedVariants:report.pricedVariants,transcribedGroups:report.sourceGroups,transcribedRows:report.sourceVariants,unambiguousSourceRows:report.pricedSourceRows,pendingGroups:pending.length,blankSourceRows:report.blankSourceRows.length}));
