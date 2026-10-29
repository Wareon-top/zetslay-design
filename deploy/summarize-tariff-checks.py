"""Print bounded failure reasons after TAP totals, leaving the full log on disk."""
import re,sys
from pathlib import Path

def summary(text):
 text=re.sub(r'\x1b\[[0-9;]*m','',text)
 lines=text.splitlines();failures=[]
 for i,line in enumerate(lines):
  if not re.match(r'\s*not ok\s+\d+',line):continue
  block=[]
  for following in lines[i+1:]:
   if re.match(r'\s*(?:# Subtest:|(?:not )?ok\s+\d+|1\.\.)',following):break
   block.append(following)
  details=[]
  for j,entry in enumerate(block):
   if re.match(r'\s*(?:location|code|error):',entry):
    value=entry.strip()
    if re.fullmatch(r'error:\s*[|>][-+]?',value):
     value='error: '+next((x.strip() for x in block[j+1:] if x.strip()),'Неизвестная ошибка')
    details.append(value[:240])
  failures.append(line.strip()[:240]+('\n  '+'\n  '.join(details[:3]) if details else ''))
 if failures:return ('Не пройдены проверки:\n'+'\n'.join(failures[:3])+('\nОстальные ошибки — в полном логе.' if len(failures)>3 else ''))[:1800]
 tail='\n'.join(line[:240] for line in lines[-8:])
 return 'Проверка остановилась вне TAP. Последние строки:\n'+(tail or 'Лог проверки пуст.')

if __name__=='__main__':
 try:print(summary(Path(sys.argv[1]).read_text(errors='replace')))
 except (OSError,IndexError):print('Откройте полный лог установки для определения причины.')
