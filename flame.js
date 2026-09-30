// Black flame (Adolla hero). A small WebGL fragment shader: domain-warped
// noise rising from the bottom edge; where the flame is dense it's pure
// black, and a thin molten rim glows where it meets the air. Runs on its
// own, not tied to the cursor. Falls back to a static CSS gradient if
// WebGL isn't there, and slows to a still frame for reduced-motion users.
(function () {
  const c = document.getElementById('flame');
  if (!c) return;
  const gl = c.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { c.classList.add('fallback'); return; }
  const vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const fs = `precision highp float;
uniform vec2 r;uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
// density of the black fire at p: tall licking tongues, pulled upward
float fire(vec2 p){
  float sway=(fbm(vec2(p.y*2.2-t*.9,p.x*.7+t*.1))-.5)*.35*p.y;
  vec2 q=vec2((p.x+sway)*4.6,p.y*1.05-t*1.2);
  vec2 w=vec2(fbm(q*.9+vec2(0.,-t*.35)),fbm(q*.8+vec2(4.3,-t*.5)));
  float turb=fbm(q+w*1.8);
  float tall=.24+.4*fbm(vec2(p.x*1.4+7.,t*.12));          // where the big tongues rise
  float body=1.-p.y/tall;                                     // 1 at the floor, 0 at the tip line
  return body*.9+(turb-.5)*2.1*(.3+p.y*1.1);
}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  float asp=r.x/r.y;
  vec2 p=vec2((uv.x-.5)*asp,uv.y);
  float d=fire(p);
  float core=smoothstep(.02,.1,d);                           // the black flame itself
  float rim=smoothstep(-.1,.02,d)*(1.-smoothstep(.02,.1,d)); // thin burning outline
  float halo=smoothstep(-.55,.02,d)*(1.-core);               // heat bleeding into the air
  vec3 bg=vec3(.022,.014,.014)+vec3(.12,.02,.03)*pow(1.-uv.y,2.);
  vec3 col=bg;
  col+=vec3(.2,.01,.05)*halo*halo*.8;                        // deep crimson haze
  col+=mix(vec3(.32,.0,.04),vec3(.78,.1,.07),smoothstep(.4,1.,rim))*rim*.95;
  // inside: true black, with slow oily purple-red swirls so it reads as fire, not a shadow
  float oil=fbm(vec2(p.x*4.,p.y*3.-t*1.1)+fbm(p*3.+t*.2));
  vec3 inner=vec3(.006,.002,.004)+vec3(.09,.0,.05)*smoothstep(.55,.85,oil)*(1.-uv.y*.6);
  col=mix(col,inner,core);
  // embers: small round sparks drifting up and swaying
  for(int k=0;k<2;k++){
    float sc=26.+float(k)*18.;
    vec2 e=vec2(p.x*sc+sin(p.y*6.+t+float(k)*2.)*1.2,p.y*sc-t*(3.+float(k)*2.));
    vec2 id=floor(e),f=fract(e)-.5;
    float rnd=h(id+float(k)*7.);
    float on=step(.965,rnd)*smoothstep(.95,.35,uv.y)*(1.-core);
    float dot_=smoothstep(.22,.0,length(f+vec2(rnd-.5,0.)*.4));
    col+=mix(vec3(.9,.12,.08),vec3(1.,.45,.2),rnd)*dot_*on*(.5+.5*sin(t*6.+rnd*40.));
  }
  float vig=smoothstep(1.3,.3,length((uv-vec2(.5,.35))*vec2(asp*.75,1.)));
  gl_FragColor=vec4(col*mix(.6,1.,vig),1.);
}`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) { c.classList.add('fallback'); return; }
  const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let scale = 0.75, visible = true, last = 0, avg = 16;
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
    const w = Math.max(2, Math.round(c.clientWidth * dpr)), h = Math.max(2, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
  }
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(c);
  const t0 = performance.now();
  function frame(now) {
    if (last) { avg = avg * 0.92 + (now - last) * 0.08; if (avg > 24 && scale > 0.4) scale *= 0.95; }
    last = now;
    if (visible) { size(); gl.uniform2f(uR, c.width, c.height); gl.uniform1f(uT, still ? 12.0 : (now - t0) / 1000); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    if (!still) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => { if (still) requestAnimationFrame(frame); });
})();
