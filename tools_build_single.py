"""Genera 4TIMER.html (un solo archivo con todo incluido) a partir de www/. Uso: python3 tools_build_single.py"""
import base64, re, os
w='www/'
def b64(p): return base64.b64encode(open(w+p,'rb').read()).decode()
css=open(w+'css/app.css',encoding='utf8').read()
css=re.sub(r"url\('\.\./fonts/([^']+)'\)", lambda m: "url('data:font/woff2;base64,%s')" % b64('fonts/'+m.group(1)), css)
js=''
for f in ['timer','exercises','store','audio','led','map','share','run','runui','app']:
    s=open(w+'js/%s.js'%f,encoding='utf8').read()
    assert '</script' not in s
    js+='/* ---- %s.js ---- */\n%s\n'%(f,s)
js=js.replace("var defaultLogo = 'icons/gym-logo.webp';","var defaultLogo = 'data:image/webp;base64,%s';"%b64('icons/gym-logo.webp'))
html=open(w+'index.html',encoding='utf8').read()
html=html.replace('<link rel="manifest" href="manifest.webmanifest">\n','')
html=html.replace('<link rel="icon" href="icons/icon-192.png">','<link rel="icon" href="data:image/png;base64,%s">'%b64('icons/icon-192.png'))
html=html.replace('<link rel="stylesheet" href="css/app.css">','<style>\n%s\n</style>'%css)
html=re.sub(r'  <script src="js/[^"]+"></script>\n','',html)
html=html.replace('</body>','<script>\n%s\n</script>\n</body>'%js)
open('4TIMER.html','w',encoding='utf8').write(html)
print(os.path.getsize('4TIMER.html')//1024,'KB')
