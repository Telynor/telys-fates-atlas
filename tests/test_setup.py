import importlib.util
from pathlib import Path
import unittest
import urllib.request
import json

spec=importlib.util.spec_from_file_location('bridge',Path(__file__).resolve().parents[1]/'companion/gma_bridge.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class Value:
 def __init__(self,value=''):self.value=value
 def get(self):return self.value
 def set(self,value):self.value=value
class Widget:
 def __init__(self,var=None):self.var=var or Value();self.state='normal'
 def cget(self,key):return self.state
 def configure(self,**kwargs):self.state=kwargs.get('state',self.state)
 def delete(self,*args):self.var.set('')
 def insert(self,at,value):self.var.set(self.var.get()+value)
 def selection_present(self):return False
 def focus_set(self):pass
class Root:
 def __init__(self):self.clipboard=''
 def clipboard_get(self):return self.clipboard
 def clipboard_clear(self):self.clipboard=''
 def clipboard_append(self,value):self.clipboard+=value
 def update_idletasks(self):pass
 def destroy(self):pass
class TestSetup(unittest.TestCase):
 def setUp(self):
  self.ui=b.SetupWindow.__new__(b.SetupWindow);u=self.ui
  u.root=Root();u.port=0;u.server=None
  u.origin=Value();u.key=Value();u.address=Value();u.token=Value();u.status=Value()
  u.origin_entry=Widget(u.origin);u.key_entry=Widget(u.key)
  u.paste_origin=Widget();u.paste_key=Widget();u.start_button=Widget();u.stop_button=Widget()
 def tearDown(self):self.ui.stop()
 def test_paste_start_copy_and_stop(self):
  u=self.ui;u.root.clipboard=' http://localhost:30000/game ';u.paste(u.origin_entry)
  self.assertEqual(u.origin.get(),'http://localhost:30000/game')
  u.root.clipboard='gma_fake_test_key';u.paste(u.key_entry);self.assertEqual(u.key.get(),'gma_fake_test_key')
  u.start();self.assertIsNotNone(u.server);self.assertEqual(u.key.get(),'');self.assertEqual(u.key_entry.state,'disabled')
  request=urllib.request.Request(u.address.get()+'/status',headers={'Origin':'http://localhost:30000','X-Atlas-Token':u.token.get()})
  with urllib.request.urlopen(request) as response:self.assertTrue(json.load(response)['ok'])
  u.copy(u.token.get());self.assertEqual(u.root.clipboard,u.token.get())
  server=u.server;u.stop();self.assertEqual(server.api_key,'');self.assertEqual(u.token.get(),'');self.assertEqual(u.key_entry.state,'normal')
 def test_invalid_values_stay_editable(self):
  u=self.ui;u.start();self.assertIsNone(u.server);self.assertEqual(u.key_entry.state,'normal')
  u.origin.set('http://localhost:30000');u.key.set('incomplete');u.start();self.assertIsNone(u.server);self.assertIn('gma_',u.status.get())
 def test_paste_replaces_old_key(self):
  u=self.ui;u.key.set('old');u.root.clipboard='gma_new';u.paste(u.key_entry);self.assertEqual(u.key.get(),'gma_new')
if __name__=='__main__':unittest.main()
