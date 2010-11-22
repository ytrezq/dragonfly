﻿window.cls || (window.cls = {});
cls.EcmascriptDebugger || (cls.EcmascriptDebugger = {});
cls.EcmascriptDebugger["6.0"] || (cls.EcmascriptDebugger["6.0"] = {});

/**
  * @constructor
  * @extends InspectionBaseView
  */

cls.EcmascriptDebugger["6.0"].DOMAttrsView = function(id, name, container_class)
{
  this._data = null;
  this._on_element_selected = function(msg)
  {
    this._data = new cls.InspectableJSObject(msg.rt_id, msg.obj_id);
    this.update();
  };
  window.messages.addListener('element-selected', this._on_element_selected.bind(this));
  this.init(id, name, container_class);
}

cls.EcmascriptDebugger["6.0"].DOMAttrsView.create_ui_widgets = function()
{

  new Settings
  (
    // id
    'dom_attrs', 
    // key-value map
    {
      "hide-null-values": true
    }, 
    // key-label map
    {
      "hide-null-values": ui_strings.S_SWITCH_HIDE_EMPTY_STRINGS
    },
    // settings map
    {
      checkboxes:
      [
        "hide-null-values"
      ]
    },
    null,
    "document"
  );

  new ToolbarConfig
  (
    'dom_attrs',
    null,
    [
      {
        handler: 'dom-attrs-text-search',
        shortcuts: 'dom-attrs-text-search',
        title: 'text search'
      }
    ]
  )

  new Switches
  (
    'dom_attrs',
    [
      "hide-null-values"
    ]
  );


  var text_search = new TextSearch();

  var onViewCreated = function(msg)
  {
    if( msg.id == 'dom_attrs' )
    {
      text_search.setContainer(msg.container);
      text_search.setFormInput(views.dom_attrs.getToolbarControl( msg.container, 'dom-attrs-text-search'));
    }
  }

  var onViewDestroyed = function(msg)
  {
    if( msg.id == 'dom_attrs' )
    {
      text_search.cleanup();
    }
  }

  messages.addListener('view-created', onViewCreated);
  messages.addListener('view-destroyed', onViewDestroyed);

  eventHandlers.input['dom-attrs-text-search'] = function(event, target)
  {
    text_search.searchDelayed(target.value);
  }

  ActionBroker.get_instance().get_global_handler().
  register_shortcut_listener('dom-attrs-text-search', 
                             cls.Helpers.shortcut_search_cb.bind(text_search));
  
};
