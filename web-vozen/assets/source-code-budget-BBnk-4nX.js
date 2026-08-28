var e=524288;function t(e){let t=2166136261;for(let n=0;n<e.length;n+=1)t^=e.charCodeAt(n),t=Math.imul(t,16777619);return`${e.length}:${(t>>>0).toString(36)}`}function n(e){if(e.length===0)return 0;let t=1;for(let n=e.indexOf(`
`);n!==-1;)t+=1,n=e.indexOf(`
`,n+1);return e.endsWith(`
`)?t-1:t}function r(t){let r=n(t);if(t.length<=e&&r<=5e3)return null;let i=0,a=0;for(let n=0;n<t.length&&i<5e3;){let r=t.indexOf(`
`,n),o=r===-1?t.length:r;if(o>e&&i>0)break;i+=1,a=o,n=o+1}return{contents:t.slice(0,a),renderedLineCount:i,totalLineCount:r}}export{r as n,t};