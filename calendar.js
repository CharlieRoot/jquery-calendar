(function ($) {
	
	"use strict";
	
	if (typeof $ === 'undefined')
		throw new Error("calendar is jQuery plugin, please include jQuery");
	
	var names = {
		months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
		weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
	};
	
	var methods = {
		/*****
		 *
		 * initializer
		 * saves settings to data-calendar attribute of an element
		 * adds class ui-calendar and updates element
		 *
		 **/
		init: function(options) {
			var settings = $.extend({
				locale: "en",
				weekStart: 0,
				dateShown: new Date()
			}, options);

			settings.locale = localizer(settings.locale);
			
			if (!(settings.dateShown instanceof Date))
				settings.dateShown = new Date(String(settings.dateShown));
			settings.dateShown = dateRoundedToMonth(settings.dateShown);
			
			settings.weekStart %= 7;
			
			return this.each(function() {
				var $this = $(this),
					data = $this.data('calendar');

				if (!data) {					
					$this.addClass("ui-calendar");
					$this.html("").css("opacity", 0);
					$this.append($("<div>").addClass("ui-calendar-head")
										.append($("<div>").addClass("ui-calendar-title").append($("<span /><span />")))
										.append($("<div>").addClass("ui-calendar-selectors")
													.append($("<div>").addClass("ui-calendar-select-year"))
													.append($("<div>").addClass("ui-calendar-select-month"))));
					$this.append(
						$("<div>")
							.addClass("ui-calendar-body-sizer")
							.append($("<div>").addClass("ui-calendar-weekdays-row"))
							.append($("<div>").addClass("ui-calendar-body"))
						);

					$this.append(
						$("<div>").addClass("ui-calendar-popover")
							.append($("<div>").addClass("popover-arrow popover-arrow-left"))
							.append($("<div>").addClass("popover-content"))
							.append($("<div>").addClass("popover-close").html("✖").click(function () { 
								data.elements.popover.fadeTo(200, 0, function () {
									data.elements.popover.removeClass("in").find(".popover-content").empty();
								}); 
							}))
							.append($("<div>").addClass("popover-arrow popover-arrow-right"))
						);

					data = {
						target : $this,
						settings: settings,
						events: { 
							maxId: 0,
							maxDate: null,
							minDate: null,
							store: {},
							idtodate: {}
						},
						elements: {
							titleMonth: $this.find(".ui-calendar-title>span:first-child"),
							titleYear: $this.find(".ui-calendar-title>span:nth-child(2)"),
							yearSelector: $this.find(".ui-calendar-select-year"),
							monthSelector: $this.find(".ui-calendar-select-month"),
							body: $this.find(".ui-calendar-body"),
							weekdays: $this.find(".ui-calendar-weekdays-row"),
							popover: $this.find(".ui-calendar-popover")
						},
						yearsShiftCount: 6,
						monthsShiftCount: 8
					};

					$(window).resize(function() {
						updateSelectorsScroll($this, data, data.elements.yearSelector, data.elements.monthSelector); 
					});

					$this.data('calendar', data);
				}
				methods.update.apply($this);
			});
		},

		/*****
		 *
		 * update
		 * draws entire calendar if no parameter is given
		 * otherwise redraws given date cell if it is on screen
		 *
		 **/
		update: function(updateDate) {
			return this.each(function() {
				var $this = $(this),
					data = $this.data('calendar');

				if (data) {
					if (!updateDate) {
						updateTitle($this, data, data.settings.dateShown);
						drawSelectors($this, data, data.settings.dateShown);
						drawWeekdays($this, data);
						drawBody($this, data, data.elements.body);
						$this.fadeTo(1000, 1);
					} else {
						var udt = dateRoundedToDay(updateDate);
						if (data.minDateShown <= udt && data.maxDateShown >= udt) {
							var upEl = $this.find(".ui-calendar-day")
											.filter(function(index, el) { return ($(el).data("calendar-date") - udt == 0); })
											.find(".events-area");
							upEl.empty();
							drawEvents($this, udt, upEl, data);
						}
					}
				}
			});
		},

		/*****
		 *
		 * shiftDate
		 * shifts date currently shown to given number of months
		 *
		 **/
		shiftDate: function(shift) {
			return this.each(function() {
				var $this = $(this),
					data = $this.data('calendar');

				if (data && shift) {
					var __ = data.settings.locale;
					var dt = dateIncrementedByMonths(data.settings.dateShown, shift);
					var yearShift = dt.getFullYear() - data.settings.dateShown.getFullYear();

					data.elements.popover.fadeTo(200, 0, function () { 
						data.elements.popover.removeClass("in").find(".popover-content").empty();
					});

					// regenerate years selector
					if (yearShift) {
						if (Math.abs(yearShift) < data.yearsShiftCount*2 + 1) { // add some items
							if (yearShift < 0) {
								var yearEl = data.elements.yearSelector.find("span:first-child");
								var year = parseInt(yearEl.html());
								for (var y = year + yearShift; y < year; ++y) {
									yearEl.before($("<span>").click(performShiftDate.bind($this)).html(y));
									data.elements.yearSelector.find("span:last-child").remove();
								}
							} else {
								var yearEl = data.elements.yearSelector.find("span:last-child");
								var year = parseInt(yearEl.html());
								for (var y = year + yearShift; y > year; --y) {
									yearEl.after($("<span>").click(performShiftDate.bind($this)).html(y));
									data.elements.yearSelector.find("span:first-child").remove();
								}
							}
						} else { // regenerate totally
							data.elements.yearSelector.empty();
							drawYearSelector($this, data.elements.yearSelector, data, dt);
						}
	
						// regenerate shifts and classes
						data.elements.yearSelector.find("span").each(function (index, el) {
							var shift = index - data.yearsShiftCount;
							$(el).removeClass()
								.addClass("ui-calendar-date-distance-" + Math.abs(shift))
								.data("calendar-shift", shift*12);
						});
					}

					// regenerate months selector
					if (Math.abs(shift) < data.monthsShiftCount*2 + 1) { // add some items
						if (shift < 0) {
							var monthEl = data.elements.monthSelector.find("span:first-child");
							var elDt = dateIncrementedByMonths(data.settings.dateShown, monthEl.data("calendar-shift"));
							for (var newDt = dateIncrementedByMonths(elDt, shift);
								elDt - newDt > 0; newDt = dateIncrementedByMonths(newDt, 1)) {
								monthEl.before($("<span>").click(performShiftDate.bind($this)).html(__(names.months[newDt.getMonth()])));
								data.elements.monthSelector.find("span:last-child").remove();
							}
						} else {
							var monthEl = data.elements.monthSelector.find("span:last-child");
							var elDt = dateIncrementedByMonths(data.settings.dateShown, monthEl.data("calendar-shift"));
							for (var newDt = dateIncrementedByMonths(elDt, shift);
								elDt - newDt < 0; newDt = dateIncrementedByMonths(newDt, -1)) {
								monthEl.after($("<span>").click(performShiftDate.bind($this)).html(__(names.months[newDt.getMonth()])));
								data.elements.monthSelector.find("span:first-child").remove();
							}
						}
					} else { // regenerate totally
						data.elements.monthSelector.empty();
						drawMonthSelector($this, data.elements.monthSelector, data, dt);
					}

					// regenerate shifts and classes
					data.elements.monthSelector.find("span").each(function (index, el) {
						var shift = index - data.monthsShiftCount;
						$(el).removeClass()
							.addClass("ui-calendar-date-distance-" + Math.abs(shift))
							.data("calendar-shift", shift);
					});

					// scroll to central (selected elements)
					updateSelectorsScroll($this, data, data.elements.yearSelector, data.elements.monthSelector);

					// change title
					updateTitle($this, data, dt);
					data.settings.dateShown = dt;

					data.elements.body.fadeTo(250, 0, function() {
						data.elements.body.empty();
						drawBody($this, data, data.elements.body);
						data.elements.body.fadeTo(250, 1);
					});
				}
			});
		},

		showDate: function(showdt) {
			return this.each(function() {
				var $this = $(this),
					data = $this.data('calendar');

				if (data) {
					var __ = data.settings.locale;

					var dt = dateRoundedToMonth(new Date(showdt));
					var yearShift = dt.getFullYear() - data.settings.dateShown.getFullYear();
					var monthShift = yearShift*12 + dt.getMonth() - data.settings.dateShown.getMonth();

					if (monthShift)
						methods.shiftDate.call($this, monthShift);
				}
			});
		},

		/*****
		 *
		 * addEvent
		 * adds event to calendar and updates view
		 * parameter e of form { date: "2001-10-01", text: "event description" }
		 * e.date can be text parseable by Date() or Date object
		 *
		 **/
		addEvent: function(e) {
			return this.each(function() {
				var $this = $(this),
					data = $this.data('calendar');

				if (data && e) {
					if (!e.date)
						$.error("Event's property date is invalid");
					
					if (!e.text || e.text == "")
						$.error("Event's property text is empty");

					var dt = new Date(e.date);
					var dtkey = ISODate(dt);

					if (typeof data.events.store[dtkey] == 'undefined')
						data.events.store[dtkey] = new Array();
					
					data.events.store[dtkey].push({id: ++data.events.maxId, text: e.text});
					data.events.idtodate[data.events.maxId] = dtkey;
					if (!data.events.maxDate || data.events.maxDate < dt)
						data.events.maxDate = dt;
					if (!data.events.minDate || data.events.minDate > dt)
						data.events.minDate = dt;

					methods.update.call($this, dt);
				}
			});
		}, 

		/*****
		 *
		 * removeEvent
		 * removes event from calendar with given id and updates view
		 *
		 **/
		removeEvent: function(eventid) {
			return this.each(function() {
				var $this = $(this),
					data = $this.data('calendar');

				if (data) {
					if (!eventid)
						$.error("EventId is invalid");
					
					var ev = findEventInStore(data.events, eventid);
					if (!ev)
						$.error("Event with id " + eventid + " not found");

					delete data.events.idtodate[eventid];
					data.events.store[ev.date] = data.events.store[ev.date].filter(function(item) { return (item.id != eventid); });
					if (data.events.store[ev.date].length == 0)
						delete data.events.store[ev.date];

					methods.update.call($this, (new Date(ev.date)));
				}
			});
		}, 

		/*****
		 *
		 * changeEvent
		 * changes event with given id text and updates view
		 * parameter ev of form { id: eventid, text: "New text" }
		 *
		 **/
		changeEvent: function(ev) {
			return this.each(function() {
				var $this = $(this),
					data = $this.data('calendar');

				if (data) {
					if (!ev || !ev.id)
						$.error("EventId is invalid");
					
					var found = findEventInStore(data.events, ev.id);
					if (!found)
						$.error("Event with id " + ev.id + " not found");

					found.event.text = ev.text;

					methods.update.call($this, (new Date(found.date)));
				}
			});
		}, 

	};

	/*****
	 *
	 * Plugin function
	 *
	 **/
	$.fn.calendar = function(method) {
		if (methods[method])
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		else if (typeof method === 'object' || !method)
			return methods.init.apply(this, arguments);
		else
			$.error("Method '" + method + "' does not exist in jQuery.calendar");
	};


	/**********************************
	 *
	 * internal functions section
	 * sometime should be collected in something like var $$ = { ... }
	 *
	 **********************************/
	
	/*****
	 *
	 * formatting and padding
	 * 
	 **/
	function format(string) {
		var args = Array.prototype.slice.call(arguments, 1);

		return string.replace(/\{\{|\}\}|\{(\d+)\}/g, function (m, n) {
    		if (m == "{{") { return "{"; }
    		if (m == "}}") { return "}"; }
    		return args[n];
  		});
	}

	function lpad(string, sym, len) {
		var res = (string instanceof String ? string : String(string));
		while (res.length < len) res = sym + res;
		return res;
	}

	function rpad(string, sym, len) {
		var res = (string instanceof String ? string : String(string));
		while (res.length < len) res += sym;
		return res;
	}

	function ISODate(dt) {
		return format("{0}-{1}-{2}", dt.getFullYear(), lpad(dt.getMonth()+1, "0", 2), lpad(dt.getDate(), "0", 2));
	}

	/*****
	 *
	 * dateRoundedToDay
	 * @param date to be rounded
	 * @return date with time set to 00:00:00
	 *
	 **/
	function dateRoundedToDay(dt) {
		return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
	}

	/*****
	 *
	 * dateRoundedToDay
	 * @param date to be rounded
	 * @return date with month day set to 1 and time set to 00:00:00
	 *
	 **/
	function dateRoundedToMonth(dt) {
		return new Date(dt.getFullYear(), dt.getMonth(), 1);
	}

	/*****
	 *
	 * dateIncrementedByDays
	 * @param date to be rounded
	 * @return date 
	 *
	 **/
	function dateIncrementedByDays(dt, days) {
		var res = new Date(dt);
		res.setDate(res.getDate() + days);
		return res;
	}

	/*****
	 *
	 * dateIncrementedByMonths
	 * @param date to be rounded
	 * @return date 
	 *
	 **/
	function dateIncrementedByMonths(dt, months) {
		var res = new Date(dt);
		res.setMonth(res.getMonth() + months);
		return res;
	}

	function findEventInStore(eventstore, eventid) {
		if (typeof eventstore.idtodate[eventid] == 'undefined')
			return null;

		var f = eventstore.store[eventstore.idtodate[eventid]].filter(function(item) { return (item.id === eventid); });
		if (f.length)
			return { date: eventstore.idtodate[eventid], event: f[0] };

		return null;
	}

	function performShiftDate(e) {
		this.calendar("shiftDate", $(e.target).data("calendar-shift"));
	}

	function updateTitle($this, data, showdt) {
		var __ = data.settings.locale;

		data.elements.titleMonth.html(__(names.months[showdt.getMonth()]));
		data.elements.titleYear.html(showdt.getFullYear());
	}

	/*****
	 *
	 * updateSelectorsScroll
	 * scrolls selectors so selected year and month appear in center
	 *
	 * @param $this - calendar element
	 * @param data - calendar data
	 * @param ysel - year selector element
	 * @param msel - month selector element
	 *
	 **/
	function updateSelectorsScroll($this, data, ysel, msel) {
		var selYearEl = ysel.find("span:nth-child(" + (data.yearsShiftCount + 1) + ")");
		var scrollYear = selYearEl.position().left - ysel.position().left - 
							(ysel.width() - selYearEl.width())/2 + ysel.scrollLeft();
		ysel.animate({scrollLeft: scrollYear}, 200);

		var selMonthEl = msel.find("span:nth-child(" + (data.monthsShiftCount + 1) + ")");
		var scrollMonth = selMonthEl.position().left - msel.position().left - 
							(msel.width() - selMonthEl.width())/2 + msel.scrollLeft();	
		msel.animate({scrollLeft: scrollMonth}, 200);
	}

	/*****
	 *
	 * drawPopoverContentForAdding
	 * creates a dialog for popover to add an event
	 *
	 * @param $this - calendar element
	 * @param data - calendar data
	 * @param dt - date to add event
	 * @return DOM-tree of created dialog
	 *
	 **/
	function drawPopoverContentForAdding($this, data, dt) {
		var __ = data.settings.locale;

		var actions = {
			submit: function($popover, $calendar, dt) {
				var newtext = $popover.find("input[type=text]").val();
				if (newtext != "")
					$calendar.calendar("addEvent", {date: dt, text: newtext});
				this.close($popover);
			},
			close: function($popover) {
				$popover.fadeTo(100, 0, function () { $popover.removeClass("in").find(".popover-content").empty(); });
			}
		}
		var res = $("<div>").addClass("popover-content-inner");
		res.append($("<div>").html(__("Add an event")));
		res.append(
			$("<input type='text'>")
				.addClass("popover-input focused")
				.keyup(function(e) {
					if (e.keyCode == 27)
						actions.close(data.elements.popover);
					else if (e.keyCode == 13)
						actions.submit(data.elements.popover, $this, dt);
				})
			);
		res.append(
			$("<div>")
				.addClass("popover-button popover-submit")
				.click(function() { actions.submit(data.elements.popover, $this, dt); })
				.html(__("OK"))
			);
		res.append(
			$("<div>")
				.addClass("popover-button popover-cancel")
				.click(function() { actions.close(data.elements.popover); })
				.html(__("Cancel"))
			);
		return res;
	}

	/*****
	 *
	 * drawPopoverContentForEditing
	 * creates a dialog for popover to edit given event
	 *
	 * @param $this - calendar element
	 * @param data - calendar data
	 * @param eventid - event's id
	 * @return DOM-tree of created dialog
	 *
	 **/
	function drawPopoverContentForEditing($this, data, eventid) {
		var __ = data.settings.locale;

		var ev = findEventInStore(data.events, eventid);
		if (!ev)
			$.error("Event with id " + eventid + " not found");

		var actions = {
			submit: function($popover, $calendar, eventid) {
				var newtext = $popover.find("input[type=text]").val();
				if (newtext == "")
					$calendar.calendar("removeEvent", eventid);
				else
					$calendar.calendar("changeEvent", {id: eventid, text: newtext});
				this.close($popover);
			},
			close: function($popover) {
				$popover.fadeTo(100, 0, function () { $popover.removeClass("in").find(".popover-content").empty(); });
			},
			del: function($popover, $calendar, eventid) {
				$calendar.calendar("removeEvent", eventid);
				this.close($popover);
			}
		}

		var res = $("<div>").addClass("popover-content-inner");
		res.append($("<div>").html(__("Edit event")));
		res.append(
			$("<input type='text'>")
				.addClass("popover-input focused")
				.keyup(function(e) {
					if (e.keyCode == 27)
						actions.close(data.elements.popover);
					else if (e.keyCode == 13)
						actions.submit(data.elements.popover, $this, eventid);
				})
				.val(ev.event.text)
			);
		res.append(
			$("<div>")
				.addClass("popover-button popover-submit")
				.click(function() { actions.submit(data.elements.popover, $this, eventid); })
				.html(__("OK"))
			);
		res.append(
			$("<div>")
				.addClass("popover-button popover-cancel")
				.click(function() { actions.close(data.elements.popover); })
				.html(__("Cancel"))
			);
		res.append(
			$("<div>")
				.addClass("popover-button popover-delete")
				.click(function() { actions.del(data.elements.popover, $this, eventid); })
				.html(__("Delete"))
			);
		return res;
	}

	/*****
	 *
	 * showPopover
	 * shows popover with given content, hiding it if it's already shown then showing in new place
	 *
	 * @param $this - calendar element
	 * @param data - calendar data
	 * @param el - element which is anchor for popover new position
	 * @param content - content to show in popover
	 *
	 **/
	function showPopover($this, data, el, content) {
		var po = data.elements.popover;
		if (po.hasClass("in")) {
			po.fadeTo(100, 0, function () {
				po.removeClass("in");
				showPopover($this, data, el, content);
			});
		} else {
			var off = el.offset();
			var right = (off.left + el.width() + po.width() + 30 > $this.width());
			po.removeClass("left right").addClass(right ? "right" : "left");
			po.find(".popover-content").empty();
			po.find(".popover-content").append(content);
			off.left += ( right ? -po.width() : el.width() );
			off.top -= (po.height() - el.height())/2;
			po.offset(off);
			po.addClass("in");
			po.find(".focused").focus();
			po.fadeTo(200, 0.95);
		}
	}

	function drawYearSelector($this, ysel, data, showdt) {
		var year = showdt.getFullYear();

		for (var y = year - data.yearsShiftCount; y <= year + data.yearsShiftCount; ++y)
			ysel.append(
				$("<span>")
					.addClass("ui-calendar-date-distance-" + Math.abs(y - year))
					.data("calendar-shift", (y - year)*12)
					.click(performShiftDate.bind($this))
					.html(y));
	}

	function drawMonthSelector($this, msel, data, showdt) {
		var __ = data.settings.locale;
		var year = showdt.getFullYear();
		var month = showdt.getMonth();

		for (var m = month - data.monthsShiftCount; m <= month + data.monthsShiftCount; ++m) {
			var dt = new Date(year, m, 1);
			msel.append(
				$("<span>")
					.addClass("ui-calendar-date-distance-" + Math.abs(m - month))
					.data("calendar-shift", m - month)
					.click(performShiftDate.bind($this))
					.html(__(names.months[dt.getMonth()])));
		}
	}

	function drawSelectors($this, data, showdt) {
		drawYearSelector($this, data.elements.yearSelector, data, showdt);
		drawMonthSelector($this, data.elements.monthSelector, data, showdt);
		updateSelectorsScroll($this, data, data.elements.yearSelector, data.elements.monthSelector);
	}

	function drawEvents($this, dt, el, data) {
		var dtkey = ISODate(dt);
		if (typeof data.events.store[dtkey] != 'undefined') {
			var events = data.events.store[dtkey];
			for (var e in events)
				el.append(
					$("<div>")
						.addClass("event").html(events[e].text.replace(/[<>]/g, function(m) { return { '<' : '&lt;', '>': '&gt;' }[m]; }))
						.data("calendar-eventid", events[e].id)
						.click(function(e) {
							e.stopPropagation();
							showPopover($this, data, $(this), 
										drawPopoverContentForEditing($this, data, $(this).data("calendar-eventid"))); 
						})
					);
		}
	}
	
	function drawWeekdays($this, data) {
		var __ = data.settings.locale;
		var ws = (data.settings.weekStart+6)%7;
		for (var i = ws; i < ws + 7; ++i) {
			data.elements.weekdays.append(
				$("<span>")
					.addClass("ui-calendar-weekday-head")
					.addClass(i%7 > 4 ? "day-off" : "work-day")
					.html(__(names.weekdays[i%7]))
				);
		}
	}

	function drawBody($this, data, el) {
		var today = dateRoundedToDay(new Date());

		var startShift = data.settings.weekStart - data.settings.dateShown.getDay();
		if (startShift >= 0) startShift -= 7;
		var dt = dateIncrementedByDays(data.settings.dateShown, startShift);
		
		data.minDateShown = dt;
		data.maxDateShown = dateIncrementedByDays(dt, 41);

		for (var i = 0; i < 6; ++i) {
			var daysRowEl = $("<div>").addClass("ui-calendar-days-row");
			for (var d = 0; d < 7; ++d) {
				var eventsEl = $("<div>").addClass("events-area");
				drawEvents($this, dt, eventsEl, data);

				var day = $("<div>")
							.addClass("ui-calendar-day")
							.addClass((dt.getDay()+6)%7 > 4 ? "day-off" : "work-day")
							.addClass(dt < today ? "past-day" : ( dt - today ? "" : "today" ))
							.append($("<span>").html(dt.getDate()))
							.append(eventsEl)
							.data("calendar-date", dt);

				if (dt.getMonth() != data.settings.dateShown.getMonth()) {
					day.addClass("other-month")
						.data("calendar-shift", (dt > data.settings.dateShown ? 1 : -1))
						.click(performShiftDate.bind($this));
				} else {
					day.click(function() {
							showPopover($this, data, $(this), 
										drawPopoverContentForAdding($this, data, $(this).data("calendar-date"))); 
						});
				}	
				daysRowEl.append(day);
				dt = dateIncrementedByDays(dt, 1);
			}
			el.append(daysRowEl);
		}

	}

	/*****
	 *
	 * localizer: internal localization function
	 * @param locale - language code
	 * @return singleton translation function for given locale
	 *
	 * translation function:
	 * @param msg - message in english
	 * @return translated message if translation exists otherwise original
	 *
	 **/
	function localizer(locale) {
		if (typeof localizer.messages === 'undefined') {
			localizer.messages = {
				// russian translation
				"ru": {
					// Days
					"Monday": 		"Понедельник", 
					"Tuesday": 		"Вторник", 
					"Wednesday": 	"Среда", 
					"Thursday": 	"Четверг", 
					"Friday": 		"Пятница", 
					"Saturday": 	"Суббота", 
					"Sunday": 		"Воскресенье",
					// Days (short)
					"Mon": 			"Пн", 
					"Tue": 			"Вт", 
					"Wed": 			"Ср", 
					"Thu": 			"Чт", 
					"Fri": 			"Пт", 
					"Sat": 			"Сб", 
					"Sun": 			"Вс",
					// Months
					"January": 		"Январь",
					"February": 	"Февраль",
					"March": 		"Март",
					"April": 		"Апрель",
					"May": 			"Май",
					"June": 		"Июнь",
					"July": 		"Июль",
					"August": 		"Август",
					"September": 	"Сентябрь",
					"October": 		"Октябрь",
					"November": 	"Ноябрь",
					"December": 	"Декабрь",
					// Months with day
					"January, {1}": 	"{1} января",
					"February, {1}": 	"{1} февраля",
					"March, {1}": 		"{1} марта",
					"April, {1}": 		"{1} апреля",
					"May, {1}": 		"{1} мая",
					"June, {1}": 		"{1} июня",
					"July, {1}": 		"{1} июля",
					"August, {1}": 		"{1} августа",
					"September, {1}": 	"{1} сентября",
					"October, {1}": 	"{1} октября",
					"November, {1}": 	"{1} ноября",
					"December, {1}": 	"{1} декабря",
					// Various messages
					"Add an event": 	"Добавьте событие", 
					"Cancel": 			"Отмена",
					"Edit event": 		"Изменение события",
					"Delete": 			"Удалить"
				}
			};
		}

		if (typeof localizer.funcs === 'undefined')
			localizer.funcs = {};

		if (typeof localizer.funcs[locale] == 'undefined') {
			localizer.funcs[locale] = (
				typeof localizer.messages[locale] == 'undefined'
				? function(msg) { return msg; }
				: function(msg) {
					return (
						typeof localizer.messages[locale][msg] == 'undefined' 
						? msg 
						: localizer.messages[locale][msg]
						);
				});
			localizer.funcs[locale].code = locale;
		}

		return localizer.funcs[locale];
	}

})(window.jQuery);