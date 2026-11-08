
// 글자 크기 조절 (프로젝터 거리에 맞춰) — localStorage로 전 페이지 공유
(function(){
  var SIZES=[16,17,18,19,20,22,24,26];
  function cur(){return parseInt(localStorage.getItem('lecFs')||'19',10);}
  function apply(px){document.documentElement.style.setProperty('--fs',px+'px');localStorage.setItem('lecFs',px);}
  apply(cur());
  window.lecFs=function(dir){
    var i=SIZES.indexOf(cur()); if(i<0)i=3;
    i=Math.max(0,Math.min(SIZES.length-1,i+dir)); apply(SIZES[i]);
  };
  window.lecFsReset=function(){apply(19);};
  // 리모컨/키보드로 장 이동: ←/PageUp=이전, →/PageDown/Space=다음
  var b=document.body, prev=b.getAttribute('data-prev'), next=b.getAttribute('data-next');
  document.addEventListener('keydown',function(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
    if(lock&&!lock.classList.contains('open'))return;
    if((e.key==='ArrowRight'||e.key==='PageDown')&&next){location.href=next;}
    else if((e.key==='ArrowLeft'||e.key==='PageUp')&&prev){location.href=prev;}
    else if(e.key==='+'||e.key==='='){window.lecFs(1);}
    else if(e.key==='-'){window.lecFs(-1);}
  });
  // 프롬프트 복사 버튼 — clipboard API가 막힌 환경(file:// 등)에서는 textarea 방식으로 대체
  function fallbackCopy(t){var a=document.createElement('textarea');a.value=t;a.style.position='fixed';
    a.style.opacity='0';document.body.appendChild(a);a.select();
    try{document.execCommand('copy');}catch(e){} document.body.removeChild(a);}
  document.addEventListener('click',function(e){
    var btn=e.target.closest&&e.target.closest('button.copy'); if(!btn)return;
    var t=btn.getAttribute('data-copy')||'';
    function done(){btn.textContent='복사됨';btn.classList.add('done');
      setTimeout(function(){btn.textContent='복사';btn.classList.remove('done');},1400);}
    if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).then(done,function(){fallbackCopy(t);done();});}
    else{fallbackCopy(t);done();}
  });
  // 도어락(index 전용) — 숫자 4자리 + '#'(또는 Enter). 세션 동안 유지, 탭을 닫으면 다시 잠긴다.
  var lock=document.getElementById('doorlock');
  if(lock){
    var CODE=lock.getAttribute('data-code'), buf='', lb=document.getElementById('lockbody'),
        dots=lock.querySelectorAll('.dot');
    var opened=false; try{opened=sessionStorage.getItem('aidd_unlocked')==='1';}catch(e){}
    if(opened){lock.classList.add('open');}
    function render(){dots.forEach(function(d,i){d.classList.toggle('on',i<buf.length);});}
    function press(k){
      if(k==='*'){buf='';render();return;}
      if(k==='#'){
        if(buf===CODE){lb.classList.add('ok');try{sessionStorage.setItem('aidd_unlocked','1');}catch(e){}
          setTimeout(function(){lock.classList.add('open');},450);}
        else{lb.classList.add('shake');setTimeout(function(){lb.classList.remove('shake');buf='';render();},380);}
        return;
      }
      if(/^[0-9]$/.test(k)&&buf.length<4){buf+=k;render();}
    }
    lock.querySelector('.lock-pad').addEventListener('click',function(e){
      if(e.target.tagName==='BUTTON')press(e.target.textContent.trim());});
    document.addEventListener('keydown',function(e){
      if(lock.classList.contains('open'))return;
      if(e.key==='Enter')press('#');else if(e.key==='Backspace'||e.key==='Escape')press('*');else press(e.key);
    },true);
  }
  // 첫 방문 시 조작 힌트 한 번
  if(!localStorage.getItem('lecHint')){
    var h=document.createElement('div');h.className='hint';
    h.textContent='← → 키(또는 리모컨)로 장을 넘길 수 있습니다';
    document.body.appendChild(h);setTimeout(function(){h.classList.add('show');},400);
    setTimeout(function(){h.classList.remove('show');},4600);localStorage.setItem('lecHint','1');
  }
})();
