/* Shared logo loader — replaces letter marks with uploaded logo */
(function(){
  function apply(){
    var data = localStorage.getItem('fi_logo');
    var marks = document.querySelectorAll('.logo-mark, .lm');
    marks.forEach(function(el){
      if(data){
        el.innerHTML = '<img src="'+data+'" alt="logo" style="width:100%;height:100%;object-fit:contain;display:block">';
        el.style.background = 'transparent';
        el.style.boxShadow = 'none';
        el.style.border = 'none';
        el.style.padding = '0';
        el.style.overflow = 'hidden';
      } else {
        if(el.dataset.origText && el.querySelector('img')){
          el.textContent = el.dataset.origText;
          el.style.background = '';
          el.style.boxShadow = '';
          el.style.border = '';
          el.style.padding = '';
          el.style.overflow = '';
        }
      }
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.logo-mark, .lm').forEach(function(el){
      if(!el.dataset.origText) el.dataset.origText = el.textContent.trim();
    });
    apply();
  });
  window.applyStoredLogo = apply;
  window.addEventListener('storage', function(e){ if(e.key==='fi_logo') apply(); });
})();
