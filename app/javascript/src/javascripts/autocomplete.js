let Autocomplete = {};

Autocomplete.MAX_RESULTS = 10;

Autocomplete.initialize_all = function() {
  $.widget("ui.autocomplete", $.ui.autocomplete, {
    options: {
      delay: 0,
      minLength: 1,
      autoFocus: false,
      focus: function() { return false; },
    },
    _create: function() {
      this.element.on("keydown.Autocomplete.tab", null, "tab", Autocomplete.on_tab);
      this._super();
    },
    _renderItem: Autocomplete.render_item,
    search: function(value, event) {
      if ($(this).data("ui-autocomplete")) {
        $(this).data("ui-autocomplete").menu.bindings = $();
      }
      this._super(value, event);
    },
  });

  this.initialize_tag_autocomplete();
  this.initialize_mention_autocomplete($("form div.input.dtext textarea"));
  this.initialize_fields($('[data-autocomplete="tag"]'), "tag");
  this.initialize_fields($('[data-autocomplete="artist"]'), "artist");
  this.initialize_fields($('[data-autocomplete="pool"]'), "pool");
  this.initialize_fields($('[data-autocomplete="user"]'), "user");
  this.initialize_fields($('[data-autocomplete="wiki-page"]'), "wiki_page");
  this.initialize_fields($('[data-autocomplete="favorite-group"]'), "favorite_group");
  this.initialize_fields($('[data-autocomplete="saved-search-label"]'), "saved_search_label");
}

Autocomplete.initialize_fields = function($fields, type) {
  $fields.autocomplete({
    source: async function(request, respond) {
      let results = await Autocomplete.autocomplete_source(request.term, type);
      respond(results);
    },
  });
};

Autocomplete.initialize_mention_autocomplete = function($fields) {
  $fields.autocomplete({
    select: function(event, ui) {
      Autocomplete.insert_completion(this, ui.item.value);
      return false;
    },
    source: async function(req, resp) {
      var cursor = this.element.get(0).selectionStart;
      var name = null;

      for (var i = cursor; i >= 1; --i) {
        if (req.term[i - 1] === " ") {
          return;
        }

        if (req.term[i - 1] === "@") {
          if (i === 1 || /[ \r\n]/.test(req.term[i - 2])) {
            name = req.term.substring(i, cursor);
            break;
          } else {
            return;
          }
        }
      }

      if (name) {
        let results = await Autocomplete.autocomplete_source(name, "mention");
        resp(results);
      }
    }
  });
}

Autocomplete.initialize_tag_autocomplete = function() {
  var $fields_multiple = $('[data-autocomplete="tag-query"], [data-autocomplete="tag-edit"]');

  $fields_multiple.autocomplete({
    select: function(event, ui) {
      Autocomplete.insert_completion(this, ui.item.value);
      return false;
    },
    source: async function(req, resp) {
      let term = Autocomplete.current_term(this.element);
      let results = await Autocomplete.autocomplete_source(term, "tag_query");
      resp(results);
    }
  });
}

Autocomplete.current_term = function($input) {
  let query = $input.get(0).value;
  let caret = $input.get(0).selectionStart;
  let regexp = new RegExp(`^[-~(]*(${Autocomplete.tag_prefixes().join("|")})?`);
  let match = query.substring(0, caret).match(/\S*$/)[0].replace(regexp, "");
  return match;
};

// Update the input field with the item currently focused in the
// autocomplete menu, then position the caret just after the inserted completion.
Autocomplete.insert_completion = function(input, completion) {
  // Trim all whitespace (tabs, spaces) except for line returns
  var before_caret_text = input.value.substring(0, input.selectionStart).replace(/^[ \t]+|[ \t]+$/gm, "");
  var after_caret_text = input.value.substring(input.selectionStart).replace(/^[ \t]+|[ \t]+$/gm, "");

  var regexp = new RegExp(`([-~(]*(?:${Autocomplete.tag_prefixes().join("|")})?)\\S+$`, "g");
  before_caret_text = before_caret_text.replace(regexp, "$1") + completion + " ";

  input.value = before_caret_text + after_caret_text;
  input.selectionStart = input.selectionEnd = before_caret_text.length;
};

// If we press tab while the autocomplete menu is open but nothing is
// focused, complete the first item and close the menu.
Autocomplete.on_tab = function(event) {
  var input = this;
  var autocomplete = $(input).autocomplete("instance");
  var $autocomplete_menu = autocomplete.menu.element;

  if (!$autocomplete_menu.is(":visible")) {
    return;
  }

  if ($autocomplete_menu.has(".ui-state-active").length === 0) {
    var $first_item = $autocomplete_menu.find(".ui-menu-item").first();
    var completion = $first_item.data().uiAutocompleteItem.value;

    Autocomplete.insert_completion(input, completion);
    autocomplete.close();
  }

  // Prevent the tab key from moving focus to the next element.
  event.preventDefault();
};

Autocomplete.render_item = function(list, item) {
  var $link = $("<a/>");
  $link.text(item.label);
  $link.attr("href", "/posts?tags=" + encodeURIComponent(item.value));
  $link.on("click.danbooru", function(e) {
    e.preventDefault();
  });

  if (item.antecedent) {
    var antecedent = item.antecedent.replace(/_/g, " ");
    var arrow = $("<span/>").html(" &rarr; ").addClass("autocomplete-arrow");
    var antecedent_element = $("<span/>").text(antecedent).addClass("autocomplete-antecedent");
    $link.prepend([
      antecedent_element,
      arrow
    ]);
  }

  if (item.post_count !== undefined) {
    var count = item.post_count;

    if (count >= 1000) {
      count = Math.floor(count / 1000) + "k";
    }

    var $post_count = $("<span/>").addClass("post-count").css("float", "right").text(count);
    $link.append($post_count);
  }

  if (/^tag/.test(item.type)) {
    $link.addClass("tag-type-" + item.category);
  } else if (item.type === "user") {
    var level_class = "user-" + item.level.toLowerCase();
    $link.addClass(level_class);
  } else if (item.type === "pool") {
    $link.addClass("pool-category-" + item.category);
  }

  var $menu_item = $("<div/>").append($link);
  var $list_item = $("<li/>").data("item.autocomplete", item).append($menu_item);

  var data_attributes = ["type", "antecedent", "value", "category", "post_count"];
  data_attributes.forEach(attr => {
    $list_item.attr(`data-autocomplete-${attr.replace(/_/g, "-")}`, item[attr]);
  });

  return $list_item.appendTo(list);
};

Autocomplete.autocomplete_source = function(query, type) {
  if (query === "") {
    return [];
  }

  return $.getJSON("/autocomplete.json", {
    "search[query]": query,
    "search[type]": type,
    "limit": Autocomplete.MAX_RESULTS
  });
}

Autocomplete.tag_prefixes = function() {
  return JSON.parse($("meta[name=autocomplete-tag-prefixes]").attr("content"));
};

$(document).ready(function() {
  Autocomplete.initialize_all();
});

export default Autocomplete;

