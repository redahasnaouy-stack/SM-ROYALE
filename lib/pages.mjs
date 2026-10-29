export const storePages={home:{path:'/',title:'SM ROYALE — Packaging & wellness',label:'Home'},catalogue:{path:'/catalogue/',title:'Shop the collection — SM ROYALE',label:'Shop'},about:{path:'/about/',title:'Our story — SM ROYALE',label:'About'},reviews:{path:'/reviews/',title:'Customer reviews — SM ROYALE',label:'Reviews'},contact:{path:'/contact/',title:'Visit & contact us — SM ROYALE',label:'Contact'}};
export function pageForPath(path){return Object.entries(storePages).find(([,p])=>p.path===path)?.[0];}
export function renderStorePage(template,key='home'){
 const page=storePages[key];if(!page)throw new Error('Unknown page');
 let html=template.replace('<body>','<body data-page="'+key+'">').replace(/<title>[\s\S]*?<\/title>/,'<title>'+page.title+'</title>');
 const start=html.indexOf('<main>')+6,end=html.indexOf('</main>'),main=html.slice(start,end),dialogs=[...main.matchAll(/<dialog\b[\s\S]*?<\/dialog>/g)].map(m=>m[0]).join('');
 const sections=[...main.matchAll(/<section\b[\s\S]*?<\/section>/g)].map(m=>m[0]);
 const allowed={home:s=>s.includes('class="showcase-hero"')||s.includes('id="collections"')||s.includes('class="section service-details"'),catalogue:s=>s.includes('id="catalogue"'),about:s=>s.includes('id="maison"')||s.includes('class="section service-details"'),reviews:s=>s.includes('id="reviews"'),contact:s=>s.includes('id="contact"')};
 const values=key==='home'?(main.match(/<div class="values">[\s\S]*?<\/div>/)?.[0]||''):'';
 const chosen=sections.filter(allowed[key]);let content=key==='home'?[chosen[0],values,...chosen.slice(1)].join('\n'):chosen.join('\n');
 if(key!=='home')content=content.replace(/<h2\b([\s\S]*?)<\/h2>/,'<h1$1</h1>');
 html=html.slice(0,start)+content+html.slice(end);html=html.replace('</main>','</main>'+dialogs);
 html=html.replace(/<link rel="preload"[^>]+>/g,key==='home'?'$&':'');
 html=html.replaceAll('href="#catalogue"','href="/catalogue/"').replaceAll('href="#collections"','href="/#collections"').replaceAll('href="#maison"','href="/about/"').replaceAll('href="#reviews"','href="/reviews/"').replaceAll('href="#contact"','href="/contact/"').replaceAll('href="#"','href="/"');
 html=html.replace(/<a\b[^>]*data-open-category="([a-z]+)"[^>]*>/g,(tag,category)=>tag.replace('href="/catalogue/"','href="/catalogue/?category='+category+'"'));
 return html;
}
