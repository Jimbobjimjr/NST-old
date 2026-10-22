"""Builds index.html from dev/src. Run from the repository root: python3 dev/build.py"""
import os
root = os.path.dirname(os.path.abspath(__file__))
src = lambda n: open(os.path.join(root, 'src', n), encoding='utf-8').read()
js = src('app1.js') + src('app3.js') + src('app2.js')
js = js.replace('/*__MASKS__*/', src('masks.js').rstrip('\n'))
head = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Abandoned Lands Story Map</title>
<meta name="description" content="A living map of the External Evils and Lesser Evils across the Swordcraft Abandoned Lands.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=swap">
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
<script src="config.js"></script>
<style>
'''
out = head + src('style.css') + '</style>\n</head>\n<body>\n' + src('body.html') + '<script>\n' + js + '</script>\n</body>\n</html>\n'
open(os.path.join(root, '..', 'index.html'), 'w', encoding='utf-8').write(out)
print('index.html', len(out), 'bytes')
