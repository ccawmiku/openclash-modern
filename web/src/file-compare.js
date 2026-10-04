// Semantic comparison is bounded; avoid an O(lines²) diff on router configurations.
export async function compareYaml(left,right){
 if(left.length>512*1024||right.length>512*1024)throw Error('超过 512 KiB，请使用原文视图或下载后比较，避免长时间占用浏览器')
 const {parseDocument}=await import('yaml')
 const flatten=text=>{const doc=parseDocument(text,{uniqueKeys:true,maxAliasCount:100});if(doc.errors.length)throw Error(doc.errors[0].message);const out=new Map();let visited=0;const walk=(value,path,depth)=>{if(++visited>20000||depth>30)throw Error('配置层级或项目数量超过比较容量');if(value&&typeof value==='object'){const entries=Object.entries(value);if(!entries.length)out.set(path,JSON.stringify(value));for(const[k,v]of entries)walk(v,path?`${path}.${k}`:k,depth+1)}else out.set(path,JSON.stringify(value))};walk(doc.toJS({maxAliasCount:100}),'',0);return out}
 const a=flatten(left),b=flatten(right),changes=[]
 for(const key of new Set([...a.keys(),...b.keys()]))if(a.get(key)!==b.get(key)){changes.push({path:key,before:a.get(key)??'（不存在）',after:b.get(key)??'（不存在）'});if(changes.length>=1000)throw Error('差异超过 1000 项，请下载后比较')}
 return changes
}
