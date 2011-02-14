﻿window.cls || (window.cls = {});
cls.CookieManager || (cls.CookieManager = {});
cls.CookieManager["1.0"] || (cls.CookieManager["1.0"] = {});

cls.CookieManager.CookieManagerViewBase = function()
{
  this.createView = function(container)
  {
    container.setAttribute("handler", "cookiemanager-container");
    container.setAttribute("data-menu", "cookie_refetch");
    var contextmenu = ContextMenu.get_instance();
    contextmenu.register("cookie_refetch", [
      {
        callback: (function()
        {
          return [
            {
              label: "Refresh",
              handler: (function(){ this._data_reference.refetch() }).bind(this)
            }
          ]
        }).bind(this)
      }
    ]);
    // RRR these now come in from data
    var storage_data = this._data_reference.item_list;
    if(!this._sortable_table)
    {
      this._sortable_table = new SortableTable(this._data_reference._tabledef, storage_data, null, "domain", "hostandpath", true);
      this._sortable_table.add_listener("before-render", this._before_table_render.bind(this, container));
      this._sortable_table.add_listener("after-render", this._after_table_render.bind(this, container));
    }
    if(!this._update_expiry_interval)
    {
      this._update_expiry_interval = setInterval(this._update_expiry.bind(this), 15000);
    }
    this._sortable_table.data = storage_data;
    this._before_table_render(container);
    this._table_container = container.clearAndRender(["div", this._sortable_table.render(), "class", "table_container"]);
    this._after_table_render(container);
  };

  this._before_table_render = function(container, message)
  {
    var message = message || {};
    if(this._hold_redraw_mem.active && message.target)
    {
      message.target.discard_next_render();
    }
    else
    {
      // save selection
      var selection = document.querySelectorAll(".sortable-table .selected");
      this._restore_selection = this._restore_selection || [];
      for (var i=0; i < selection.length; i++) {
        this._restore_selection.push(selection[i].getAttribute("data-object-id"));
      };
    }
  }

  this._after_table_render = function(container)
  {
    this._update_expiry();
    // restore selection
    if(this._restore_selection)
    {
      for (var i=0; i < this._restore_selection.length; i++) {
        var objectref = this._restore_selection[i];
        var elem = container.querySelector("[data-object-id='"+objectref+"']");
        if(elem)
        {
          elem.addClass("selected");
        }
      };
      this._restore_selection = null;
    }
    // context menus
    var contextmenu = ContextMenu.get_instance();
    // add delete cookie context menu per tr
    this._table_elem = this._table_container.firstChild;
    for(var i=0; i < this._table_elem.childNodes.length; i++)
    {
      this._table_elem.childNodes[i].setAttribute("data-menu", "cookie_context");
    }
    var cookie_row_context = [
      {
        callback: (function(event, target)
        {
          window.views.cookie_manager.check_to_exit_edit_mode(event, target);
          var row = target;
          while(row.nodeName !== "tr" || !row.parentNode) // todo: remove when it's fixed on menus
          {
            row = row.parentNode;
          }
          var options = [];
          var cookie_obj;
          // if row has an object-id, add edit and remove options
          var objectref = row.getAttribute("data-object-id");
          if(objectref)
          {
            // row represents a cookie, so it can be selected
            window.views.cookie_manager.select_row(event, row);
          }
          var selection = document.querySelectorAll(".sortable-table .selected");
          var selected_cookie_objects = [];
          for (var i=0; i < selection.length; i++) {
            var sel_cookie_obj = this._data_reference.get_item_by_objectref(selection[i].getAttribute("data-object-id"));
            selected_cookie_objects.push(sel_cookie_obj);
          };

          if(selected_cookie_objects.length === 1)
          {
            // Add cookie
            options.push(
              {
                label: "Add cookie",
                handler: function() {
                  var runtime = selected_cookie_objects[0].runtimes[0];
                  var inserted = window.views.cookie_manager.insert_add_item_row(row, runtime);
                  window.views.cookie_manager.select_row(null, inserted);
                }
              }
            );
            // single selection
            var sel_cookie_obj = selected_cookie_objects[0];
            if(sel_cookie_obj.is_editable)
            {
              options.push(
                {
                  label: "Edit cookie",
                  handler: function() {
                    window.views.cookie_manager.enter_edit_mode(sel_cookie_obj.objectref);
                  }
                }
              );
            }
            if(sel_cookie_obj.is_removable)
            {
              options.push(
                {
                  label: "Remove cookie",
                  handler: function() {
                    this._data_reference.remove_item(sel_cookie_obj.objectref);
                  }
                }
              );
            }
            // Add "Remove all from domain-and-path"
            // todo rrr: move to function on data instead
            // todo: use less globals
            var runtime = this._data_reference._rts[sel_cookie_obj.runtimes[0]];
            options.push(
              {
                label: "Remove cookies of " + runtime.hostname + runtime.pathname,
                handler: (function(runtime_id){
                  return function() {
                    for (var i=0; i < this._data_reference.item_list.length; i++) {
                      var cookie = this._data_reference.item_list[i];
                      if(cookie.runtimes.indexOf(runtime_id) > -1)
                      {
                        this._data_reference.remove_item(cookie.objectref);
                      }
                    };
                  }
                })(runtime.rt_id)
              }
            );
          }
          else
          {
            // multiple selection
            var removable_cookies = [];
            for (var j=0; j < selected_cookie_objects.length; j++) {
              if(selected_cookie_objects[j].is_removable)
              {
                removable_cookies.push(selected_cookie_objects[j]);
              }
            };
            if(removable_cookies.length === 1)
            {
              options.push(
                {
                  label: "Remove cookie "+(removable_cookies[0].name || ""),
                  handler: function() {
                    this._data_reference.remove_item(removable_cookies[0].objectref);
                  }
                }
              );
            }
            else
            {
              options.push(
                {
                  label: "Remove selected cookies",
                  handler: (function(cookie_list) {
                    return function()
                    {
                      for (var i=0; i < cookie_list.length; i++)
                      {
                        this._data_reference.remove_item(cookie_list[i].objectref);
                      }
                    }
                  })(removable_cookies)
                }
              );
            }
          }
          return options;
        }).bind(this)
      }
    ];
    contextmenu.register("cookie_context", cookie_row_context);

    // select and dbl-click to edit
    var rows = container.querySelectorAll("tr[data-object-id]");
    for (var i=0; i < rows.length; i++) {
      rows[i].setAttribute("handler", "cookiemanager-row-select");
      var objectref = rows[i].getAttribute("data-object-id");
      // todo: find out why this sometimes doesn't work on startup
      if(this._data_reference.get_item_by_objectref(objectref).is_editable)
      {
        rows[i].setAttribute("edit-handler", "cookiemanager-init-edit-mode");
      }
      else
      {
        rows[i].addClass("uneditable");
      }
    };
  }

  this._update_expiry = function()
  {
    for (var i=0; i < this._data_reference.item_list.length; i++)
    {
      var obj = this._data_reference.item_list[i];
      var elem = document.getElementById("expires_container_"+obj.objectref);
      if(elem)
      {
        if(new Date().getTime() < new Date(obj.expires*1000))
        {
          var fuzzy_date = function(date)
          {
            var compare_date = new Date();
            var diff = date.getTime() - compare_date.getTime();
            var in_sec     = diff / 1000;
            var in_min     = in_sec / 60;
            var in_5_min   = in_min / 20;
            var in_hours   = in_min / 60;
            var in_days    = in_hours / 24;
            var in_weeks   = in_days / 7;
            var in_months  = in_weeks / 4.3;
            var in_years   = in_months / 12;

            if(in_sec < 60)
              return "< 1 minute";
            else if (Math.round(in_min) === 1)
              return "In " + Math.round(in_min)        +" minute";
            else if (in_min < 15)
              return "In " + Math.round(in_min)        + " minutes";
            else if (in_5_min < 11)
              return "In " + Math.round(in_5_min) * 5  + " minutes";

            else if (Math.round(in_hours) === 1)
              return "In " + Math.round(in_hours)      + " hour";
            else if (in_hours < 23)
              return "In " + Math.round(in_hours)      + " hours";

            else if (Math.round(in_days) === 1)
              return                                     "Tomorrow";
            else if (in_days < 7)
              return "In " + Math.round(in_days)       + " days";

            else if (Math.round(in_weeks) === 1)
              return "In " + Math.round(in_weeks)      + " week";
            else if (in_weeks < 4.3)
              return "In " + Math.round(in_weeks)      + " weeks";

            else if (Math.round(in_months) === 1)
              return "In " + Math.round(in_months)     + " month";
            else if (in_months < 11)
              return "In " + Math.round(in_months)     + " months";

            else if (Math.round(in_years) === 1)
              return "In " + Math.round(in_years)      + " year";
            else
              return "In " + Math.round(in_years)      + " years";
          };
          elem.textContent = fuzzy_date(new Date(obj.expires*1000));
        }
        else
        {
          elem.clearAndRender(window.templates.cookie_manager.expired_value());
          // find row, add expired_cookie class
          while(elem.nodeName !== "tr" || !elem.parentNode)
          {
            elem = elem.parentNode;
          }
          if(elem.nodeName === "tr")
          {
            elem.addClass("expired_cookie");
          }
        }
      }
    }
  };

  this.select_row = function(event, elem) // public just towards actions
  {
    var event = event || {};
    var was_selected = elem.hasClass("selected");
    var is_in_edit_mode = elem.hasClass("edit_mode");
    // unselect everything, as long as
    //   not doing multiple selection. that's when:
    //     cmd / ctrl key is used
    //     more than 1 item selected and event is a right-click
    //   not currently editing this row
    var selection = document.querySelectorAll(".sortable-table .selected");
    if(!( event.ctrlKey || (event.button === 2 && selection.length > 1) ))
    {
      for (var i=0; i < selection.length; i++) {
        selection[i].removeClass("selected");
      };
    }
    elem.addClass("selected");
  };

  this.insert_add_item_row = function(row, runtime) // public just towards actions
  {
    var templ = document.documentElement.render(window.templates.cookie_manager.add_cookie_row(runtime, this._data_reference._rts));
    var inserted = row.parentElement.insertBefore(templ, row);
    inserted.querySelector("[name=name]").focus();
    return inserted;
  }

  this._hold_redraw = function()
  {
    this._hold_redraw_mem.active = true;
    this._hold_redraw_mem.timeout = setTimeout(this._resume_redraw.bind(this), 15000);
  }

  this._resume_redraw = function()
  {
    this._hold_redraw_mem.timeout && clearTimeout(this._hold_redraw_mem.timeout);
    this._hold_redraw_mem.callback && this._hold_redraw_mem.callback();
    this._hold_redraw_mem = {};
  }
  
  this.enter_edit_mode = function(objectref, event) // public just towards actions
  {
    var table_elem = document.querySelector(".sortable-table");
    var sortable_table = ObjectRegistry.get_instance().get_object(table_elem.getAttribute("data-object-id"));
    sortable_table.restore_columns(table_elem);
    var row = document.querySelector(".sortable-table tr[data-object-id='"+objectref+"']").addClass("edit_mode");
    this.select_row(event, row);
    this._hold_redraw();
    // Todo: focus input in clicked td if applicable
  }

  this.check_to_exit_edit_mode = function(event, target) // public just towards actions
  {
    this._resume_redraw();
    if(document.querySelector(".edit_mode"))
    {
      // find out if target is within some .edit_mode node. don't exit then.
      var walk_up = target;
      while(walk_up)
      {
        if(walk_up.hasClass("edit_mode"))
        {
          return;
        }
        walk_up = walk_up.parentElement;
      }
      this.exit_edit_and_save();
    }
  }

  this.exit_edit_and_save = function() // public just towards actions
  {
    this._resume_redraw();
    var edit_tr = document.querySelector("tr.edit_mode");
    if(edit_tr)
    {
      edit_tr.removeClass("edit_mode");

      var is_secure_input    = edit_tr.querySelector("[name=is_secure]");
      var is_http_only_input = edit_tr.querySelector("[name=is_http_only]");
      var runtime_input      = edit_tr.querySelector("[name=add_cookie_runtime]");
      var domain_input       = edit_tr.querySelector("[name=domain]");

      var name         = edit_tr.querySelector("[name=name]").value.trim();
      var value        = edit_tr.querySelector("[name=value]").value;
      var expires      = new Date(edit_tr.querySelector("[name=expires]").value || 0).getTime();
      var path         = edit_tr.querySelector("[name=path]").value.trim();
      var is_secure    = !!(is_secure_input && is_secure_input.checked);
      var is_http_only = !!(is_http_only_input && is_http_only_input.checked);
      // "runtime" comes from [select] or [input type=hidden], domain comes directly from [input]
      // or from the runtimes .hostname in case there's a limited choice because addcookie is not
      // present
      var runtime      = runtime_input && parseInt(runtime_input.value.split(",")[0]);
      var domain       = domain_input && domain_input.value.trim() || runtime && this._data_reference._rts[runtime].hostname;

      var cookie;
      var object_id = edit_tr.getAttribute("data-object-id");
      if(object_id)
      {
        cookie = this._data_reference.get_item_by_objectref(object_id);
      }
      // check if unmodified
      if(cookie &&
          (
            name === cookie.name &&
            value === cookie.value &&
            expires === new Date(cookie.expires*1000).getTime() &&
            path === cookie.path &&
            is_secure === cookie.isSecure &&
            is_http_only === cookie.isHTTPOnly &&
            domain === this._data_reference._rts[cookie.runtimes[0]].hostname
          )
      )
      {
        return;
      }

      // remove old cookie
      if(cookie)
      {
        this._data_reference.remove_item(cookie.objectref, true);
      }

      // and add modified / new
      this._data_reference.write_item({
        domain:       domain,
        name:         name,
        path:         path || "/",
        value:        value,
        expires:      expires,
        is_secure:    +is_secure,
        is_http_only: +is_http_only,
        runtime:      runtime
      });
    }
  }

  // DEPENDEND ON SERVICE VERSION - those might get overwritten
  this._is_secure_renderer = function(obj)
  {
    if(obj.is_runtimes_placeholder)
    {
      return;
    }
    if(typeof obj.isSecure === "number")
    {
      return window.templates.cookie_manager.boolean_value(obj.isSecure);
    }
    return window.templates.cookie_manager.unknown_value();
  }

  this._is_http_only_renderer = function(obj)
  {
    // this depends on the service version, can get overwritten
    if(obj.is_runtimes_placeholder)
    {
      return;
    }
    if(typeof obj.isHTTPOnly === "number")
    {
      // this will depend on the service version, it gets editable with 1.1
      return window.templates.cookie_manager.boolean_value(obj.isHTTPOnly);
    }
    return window.templates.cookie_manager.unknown_value();
  }
  // END DEPENDEND ON SERVICE VERSION

  this._init = function(id, name, container_class, data_reference)
  {
    this._hold_redraw_mem = {};
    this.init(id, name, container_class);
    this._data_reference = data_reference;
  };

};
cls.CookieManager.CookieManagerViewBase.prototype = ViewBase;

cls.CookieManager["1.0"].CookieManagerView = function(id, name, container_class, data_reference)
{
  this._init(id, name, container_class, data_reference);
}
cls.CookieManager["1.0"].CookieManagerView.prototype = new cls.CookieManager.CookieManagerViewBase();

cls.CookieManager["1.1"] || (cls.CookieManager["1.1"] = {});
cls.CookieManager["1.1"].CookieManagerView = function(id, name, container_class)
{
  this._write_cookie = function(c)
  {
    var tag = tagManager.set_callback(this, this._data_reference.refetch);
    services['cookie-manager'].requestAddCookie(tag,[c.domain, c.name, c.path, c.value, c.expires / 1000, c.is_secure, c.is_http_only]);
  }

  this._is_secure_renderer = function(obj) {
    if(obj.is_runtimes_placeholder)
    {
      return;
    }
    if(typeof obj.isSecure === "number")
    {
      return window.templates.cookie_manager.editable_secure(obj.isSecure);
    }
    return window.templates.cookie_manager.unknown_value();
  }

  this._is_http_only_renderer = function(obj) {
    if(obj.is_runtimes_placeholder)
    {
      return;
    }
    if(typeof obj.isHTTPOnly === "number")
    {
      return window.templates.cookie_manager.editable_http_only(obj.isHTTPOnly);
    }
    return window.templates.cookie_manager.unknown_value();
  }

  this.insert_add_item_row = function(row, runtime)
  {
    var default_domain = this._data_reference._rts[runtime].hostname;
    var templ = document.documentElement.render(window.templates.cookie_manager.add_cookie_row_all_editable(default_domain));
    var inserted = row.parentElement.insertBefore(templ, row);
    inserted.querySelector("[name=name]").focus();
    return inserted;
  }
}
cls.CookieManager["1.1"].CookieManagerView.prototype = new cls.CookieManager.CookieManagerViewBase();
