import importlib.util
from pathlib import Path
import threading
import unittest
import urllib.request
import urllib.error
import json

spec=importlib.util.spec_from_file_location('gma_bridge',Path(__file__).resolve().parents[1]/'companion/gma_bridge.py')
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
class TestBridge(unittest.TestCase):
 def setUp(self):
  self.server=bridge.Bridge(('127.0.0.1',0),api_key='gma_test_do_not_publish',token='pairing-test',origin='http://localhost:30000')
  self.paths=[]
  def upstream(path):
   self.paths.append(path);return json.dumps({'data':[{'id':'campaign1','title':'Test'}],'page':{'has_more':False}}).encode()
  self.server.upstream=upstream
  threading.Thread(target=self.server.serve_forever,daemon=True).start()
 def tearDown(self):self.server.shutdown();self.server.server_close()
 def call(self,path='/',origin='http://localhost:30000',token='pairing-test',method='GET',host=None):
  headers={'Origin':origin,'X-Atlas-Token':token}
  if host:headers['Host']=host
  request=urllib.request.Request(f'http://127.0.0.1:{self.server.server_port}'+path,headers=headers,method=method)
  try:r=urllib.request.urlopen(request)
  except urllib.error.HTTPError as e:r=e
  return r.status,r.headers,json.loads(r.read())
 def test_read(self):
  status,headers,body=self.call('/v1/campaigns?limit=100');self.assertEqual(status,200);self.assertEqual(headers['Access-Control-Allow-Origin'],'http://localhost:30000');self.assertNotIn('gma_',json.dumps(body));self.assertEqual(self.paths,['/v1/campaigns?limit=100'])
 def test_boundaries(self):
  self.assertEqual(self.call('/v1/campaigns',origin='https://evil.test')[0],403)
  self.assertEqual(self.call('/v1/campaigns',token='bad')[0],401)
  self.assertEqual(self.call('/v1/campaigns',host='evil.test')[0],403)
  self.assertEqual(self.call('/v1/account')[0],403)
  self.assertEqual(self.call('/v1/campaigns?redirect=https://evil.test')[0],403)
  self.assertEqual(self.call('/v1/campaigns',method='POST')[0],405)
  self.assertEqual(self.call('/v1/campaigns/campaign1/sessions/session1/analyses')[0],403)
  self.assertFalse(self.paths)
 def test_preflight(self):
  status,headers,body=self.call('/v1/campaigns',method='OPTIONS',token='');self.assertEqual(status,200);self.assertEqual(headers['Access-Control-Allow-Private-Network'],'true')
 def test_open_window_requires_pairing(self):
  called=threading.Event();self.server.open_window=called.set
  self.assertEqual(self.call('/open',method='POST',token='bad')[0],401);self.assertFalse(called.is_set())
  self.assertEqual(self.call('/open',method='POST',origin='https://evil.test')[0],403);self.assertFalse(called.is_set())
  self.assertEqual(self.call('/open',method='PUT')[0],405);self.assertFalse(called.is_set())
  self.assertEqual(self.call('/open',method='POST')[0],200);self.assertTrue(called.is_set());self.assertFalse(self.paths)
 def test_notes_routes(self):
  for path in ['/v1/campaigns/c1/sessions','/v1/campaigns/c1/sessions/s1','/v1/campaigns/c1/sessions/s1/notes','/v1/campaigns/c1/sessions/s1/recaps/default','/v1/campaigns/c1/sessions/s1/scenes']:
   self.assertEqual(self.call(path)[0],200,path)
if __name__=='__main__':unittest.main()
