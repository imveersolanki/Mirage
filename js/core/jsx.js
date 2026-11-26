/* Mirage core: HTML to JSX for the Next.js export. Shared by the editor and the CLI. */
export function toJSX(html){
  return html
    .replace(/\{/g,'\u0001').replace(/\}/g,'\u0002')      // park literal braces
    .replace(/\sclass="/g,' className="')
    .replace(/\sstyle="([^"]*)"/g,(m,css)=>{
      const obj = css.split(';').map(x=>x.trim()).filter(Boolean).map(decl=>{
        const k = decl.slice(0,decl.indexOf(':')).trim(), v = decl.slice(decl.indexOf(':')+1).trim();
        const key = k.startsWith('--') ? "'"+k+"'" : k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
        return key+":'"+v.replace(/'/g,"\\'")+"'";
      }).join(', ');
      return ' style={{'+obj+'}}';
    })
    .replace(/<(br|hr|img|input)([^>]*?)\s*\/?>/g,'<$1$2 />')
    .replace(/\u0001/g,"{'{'}").replace(/\u0002/g,"{'}'}");
}
