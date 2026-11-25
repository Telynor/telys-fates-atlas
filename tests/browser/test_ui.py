import asyncio,json,threading,os
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def translate_path(self,path):
  if path.startswith('/modules/telys-fates-atlas/'):
   path=path.replace('/modules/telys-fates-atlas/','/',1)
  return super().translate_path(path)
server=ThreadingHTTPServer(('127.0.0.1',8765),partial(Handler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--no-sandbox'],**({'executable_path':os.environ['ATLAS_CHROMIUM']} if os.environ.get('ATLAS_CHROMIUM') else {}))
  page=await browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(8000)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  state={'version':1,'fail':False,'opened':0}
  async def route(request):
   url=request.request.url;path=url.split('43127')[1].split('?')[0];method=request.request.method
   code=200
   if method=='OPTIONS':body={}
   elif path=='/open':
    assert method=='POST';state['opened']+=1;body={'ok':True,'opened':True}
   elif path=='/v1/campaigns':body={'data':[{'id':'c1','title':'DnD Campaign'}],'page':{'has_more':False}}
   elif path=='/v1/campaigns/c1/sessions':body={'data':[{'id':'s1','title':'First Session','played_at':'2026-11-01'},{'id':'s2','title':'Second Session','played_at':'2026-11-08'}],'page':{'has_more':False}}
   elif path.endswith('/sessions/s1'):body={'id':'s1','title':'First Session' if state['version']==1 else 'First Session revised','played_at':'2026-11-01'}
   elif path.endswith('/sessions/s2'):body={'id':'s2','title':'Second Session','played_at':'2026-11-08'}
   elif path.endswith('/recaps/default'):body={'text':f'Long-form campaign story v{state["version"]}.'}
   elif path.endswith('/notes'):
    body={'text':'Extra detailed campaign notes.'}
    if state['fail'] and '/s2/' in path:code=502;body={'error':'Source temporarily unavailable.'}
   elif path.endswith('/scenes'):body={'data':[{'id':'scene','title':'Basilica','description':'Inside the basilica.','key_events':['A surprise revelation.']}],'page':{'has_more':False}}
   else:raise Exception('Unexpected path '+path)
   await request.fulfill(status=code,content_type='application/json',body=json.dumps(body),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'X-Atlas-Token','Access-Control-Allow-Methods':'GET,OPTIONS'})
  await page.route('http://127.0.0.1:43127/**',route)
  await page.goto('http://127.0.0.1:8765/tests/browser/harness.html');await page.wait_for_function('window.ready')
  await page.get_by_role('button',name='Import from GM Assistant',exact=True).click()
  await page.get_by_label('Companion pairing token',exact=True).fill('mock-pairing-token')
  await page.get_by_role('button',name='Connect / Load campaigns',exact=True).click()
  await page.get_by_label('Campaign',exact=True).select_option('c1')
  await page.get_by_role('button',name='Open companion',exact=True).click()
  await page.locator('.fa-gma-status').filter(has_text='Companion window requested').wait_for()
  assert state['opened']==1
  assert await page.locator('iframe').count()==0
  await page.get_by_role('button',name='Fetch campaign notes',exact=True).click()
  await page.get_by_role('heading',name='Place campaign notes — DnD Campaign',exact=True).wait_for()
  await page.get_by_label('Default world',exact=True).select_option(label='Second World')
  await page.get_by_label('Default chapter',exact=True).select_option(label='Arc One')
  await page.get_by_label('Default classification',exact=True).select_option('companion')
  await page.get_by_label('First horizontal position',exact=True).fill('900')
  await page.get_by_label('Vertical position',exact=True).fill('400')
  # Defaults apply immediately; one session gets a separate individual destination.
  assert await page.get_by_label('World for First Session',exact=True).input_value()==await page.evaluate('window.getData().planets[1].id')
  first_world=await page.evaluate('window.getData().planets[0].id')
  await page.get_by_label('World for Second Session',exact=True).select_option(first_world)
  row_two=page.locator('[data-row="1"]')
  await row_two.get_by_label('X',exact=True).fill('1700')
  await page.get_by_label('Default classification',exact=True).select_option('adventure')
  await page.get_by_label('Default classification',exact=True).select_option('companion')
  assert await page.get_by_label('World for Second Session',exact=True).input_value()==first_world
  await page.locator('[data-row="1"] [name=x-1]').evaluate("el=>el.value='1750'")
  await page.get_by_role('button',name='Save',exact=True).click()
  await page.wait_for_function('window.getData().planets[1].events.length===2')
  data=await page.evaluate('window.getData()');quest=data['planets'][1]['events'][1]
  assert quest['x']==900 and quest['y']==400 and quest['type']=='companion'
  assert quest['parentChapter']==data['planets'][1]['events'][0]['id']
  assert 'Extra detailed campaign notes.' in quest['description'] and 'A surprise revelation.' in quest['description']
  assert 'mock-pairing-token' not in json.dumps(data)
  assert data['planets'][0]['events'][-1]['source']['sessionId']=='s2'
  assert data['planets'][0]['events'][-1]['x']==1750
  assert data['planets'][0]['events'][-1]['parentChapter']==''
  # Rich notes, inline image insertion, local artwork, then resync.
  await page.get_by_role('combobox',name='Planet',exact=True).select_option(label='Second World')
  await page.get_by_role('button',name='Arc One',exact=True).click()
  await page.get_by_role('button',name='Edit atlas',exact=False).click()
  await page.get_by_role('button',name='Edit First Session',exact=True).click()
  area=page.get_by_label('Description / campaign notes (Markdown)',exact=True)
  await area.press('Control+End')
  await page.get_by_role('button',name='Insert image',exact=True).click()
  await page.get_by_label('Related picture (Recap image)',exact=True).fill('modules/telys-fates-atlas/assets/journey.svg')
  await page.get_by_role('button',name='Preview formatting',exact=True).click()
  await page.locator('.fa-notes-preview img').wait_for()
  await page.get_by_role('button',name='Save',exact=True).click()
  state['version']=2
  await page.get_by_role('button',name='Resync',exact=True).click()
  await page.wait_for_function("window.getData().planets[1].events[1].description.includes('story v2')")
  updated=await page.evaluate('window.getData().planets[1].events[1]')
  assert updated['name']=='First Session revised' and updated['x']==900 and updated['type']=='companion'
  assert 'journey.svg' in updated['description'] and updated['picture'].endswith('journey.svg')
  assert 'story v1' not in updated['description']
  # Failed resync is atomic.
  state['version']=3;state['fail']=True
  before=await page.evaluate('window.getData().revision')
  await page.get_by_role('button',name='Resync',exact=True).click()
  await page.locator('.fa-error').filter(has_text='Source temporarily unavailable').wait_for()
  assert await page.evaluate('window.getData().revision')==before
  # Linked-note manager locates off-screen notes and repairs an existing import without duplicates.
  await page.locator('.fa-dialog').get_by_role('button',name='Close',exact=True).click()
  await page.get_by_role('button',name='Linked notes',exact=True).click()
  await page.get_by_role('button',name='Locate Second Session',exact=True).click()
  assert await page.get_by_role('combobox',name='Planet',exact=True).input_value()==first_world
  await page.locator('.fa-detail h2').filter(has_text='Second Session').wait_for()
  card=page.get_by_role('button',name='Second Session',exact=True)
  bounds=await card.bounding_box();viewport=await page.locator('.fa-viewport').bounding_box()
  assert bounds['x']>=viewport['x'] and bounds['x']+bounds['width']<=viewport['x']+viewport['width']
  await page.get_by_role('button',name='Linked notes',exact=True).click()
  await page.get_by_label('World for First Session revised',exact=True).select_option(first_world)
  before_move=await page.evaluate('window.getData().planets[1].events[1]')
  await page.get_by_role('button',name='Save',exact=True).click()
  await page.wait_for_function('window.getData().planets[1].events.length===1')
  moved=await page.evaluate('window.getData().planets[0].events.find(e=>e.source?.sessionId==="s1")')
  assert moved['id']==before_move['id'] and moved['description']==before_move['description'] and moved['picture']==before_move['picture']
  assert moved['source']==before_move['source'] and moved['parentChapter']==''
  assert await page.evaluate('window.getData().planets.flatMap(p=>p.events).filter(e=>e.source).length')==2
  # A fresh import identifies actual saved worlds and does not offer editable duplicate placement.
  state['fail']=False
  await page.get_by_role('button',name='Import from GM Assistant',exact=True).click()
  await page.get_by_role('button',name='Connect / Load campaigns',exact=True).click()
  await page.get_by_role('button',name='Fetch campaign notes',exact=True).click()
  await page.get_by_role('heading',name='Place campaign notes — DnD Campaign',exact=True).wait_for()
  assert await page.get_by_label('World for First Session',exact=True).is_disabled()
  assert await page.get_by_label('World for First Session',exact=True).input_value()==first_world
  assert await page.locator('.fa-saved-location').count()==2
  await page.get_by_role('button',name='Cancel',exact=True).click()
  # Reproduce two notes arriving at identical coordinates, then switch away/back and reload.
  await page.get_by_role('button',name='Linked notes',exact=True).click()
  for title in ['First Session revised','Second Session']:
   await page.get_by_label('World for '+title,exact=True).select_option(label='Second World')
   row=page.locator('.fa-gma-row').filter(has_text=title)
   await row.get_by_label('X',exact=True).fill('260')
   await row.get_by_label('Y',exact=True).fill('240')
  await page.get_by_role('button',name='Save',exact=True).click()
  await page.wait_for_function('window.getData().planets[1].events.filter(e=>e.source).length===2')
  pair=await page.evaluate('window.getData().planets[1].events.filter(e=>e.source)')
  assert abs(pair[0]['x']-pair[1]['x'])>=260 or abs(pair[0]['y']-pair[1]['y'])>=155
  second_world=await page.evaluate('window.getData().planets[1].id')
  for repeat in range(3):
   await page.get_by_role('combobox',name='Planet',exact=True).select_option(first_world)
   await page.get_by_role('combobox',name='Planet',exact=True).select_option(second_world)
   assert await page.locator('.fa-node').count()==3
  await page.get_by_role('button',name='Fit',exact=True).click()
  viewport=await page.locator('.fa-viewport').bounding_box()
  for title in ['First Session revised','Second Session']:
   box=await page.get_by_role('button',name=title,exact=True).bounding_box()
   assert box['x']>=viewport['x']-1 and box['x']+box['width']<=viewport['x']+viewport['width']+1
  await page.get_by_role('button',name='World notes (2)',exact=True).click()
  assert await page.locator('.fa-world-note').count()==2
  await page.get_by_role('button',name='Open First Session revised',exact=True).click()
  await page.locator('.fa-detail h2').filter(has_text='First Session revised').wait_for()
  await page.reload();await page.wait_for_function('window.ready')
  assert await page.evaluate('window.getData().planets[1].events.filter(e=>e.source).length')==2
  await page.get_by_role('combobox',name='Planet',exact=True).select_option(second_world)
  assert await page.locator('.fa-node').count()==3
  await page.get_by_role('button',name='World notes (2)',exact=True).click()
  assert await page.locator('.fa-world-note').count()==2
  await page.locator('.fa-dialog').get_by_role('button',name='Close',exact=True).click()
  # Players cannot see importer or pairing controls.
  await page.evaluate('game.user.isGM=false;window.api.open()')
  await page.wait_for_function("!document.querySelector('[data-cmd=gma-import]')")
  assert not errors,errors
  await page.screenshot(path=str(ROOT/'tests/browser/gma-preview.png'))
  await browser.close()
  print('PASS: campaign fetching, per-world/chapter placement, saved profiles, long-form rendering, inline images, Resync preservation, atomic failures, and player controls.')
asyncio.run(main())
