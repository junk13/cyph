var isLocalhost			= document.location.hostname == 'localhost';
var isOnion				= document.location.host.split('.').slice(-1)[0] == 'onion';

var BASE_URL			= isLocalhost ? 'http://localhost:8080/' : isOnion ? '/api/' : 'https://api.cyph.com/';
var ONION_URL			= 'https://cyphdbyhiddenbhs.onion';
var isHistoryAvailable	= typeof history != 'undefined';

if (!isLocalhost && !isOnion) {
	var theRest	= document.location.toString().split(document.location.host)[1];

	$.get(ONION_URL + '/ping', function (data) {
		if (data == 'pong') {
			var path	= '';
			switch (document.location.hostname) {
				case 'www.cyph.im':
					path	= '/im';
					break;

				case 'www.cyph.me':
					path	= '/me';
					break;
			}

			document.location.href	= ONION_URL + path + theRest;
		}
	});
}


/* Log all JS exceptions */
function errorLog (apiMethod) {
	return function () {
		var exception	= JSON.stringify(arguments);

		$.post(BASE_URL + apiMethod, {
			error: exception +
				'\n\n' + navigator.userAgent +
				'\n\n' + navigator.language +
				'\n\n' + (typeof language == 'undefined' ? '' : language) +
				'\n\n' + document.location.toString()
		});

		anal.send('exception', {
			exDescription: exception
		});
	};
}
window.onerror	= errorLog('errors');



function getString (name) {
	return $('meta[name="' + name + '"]').attr('content');
}


function getTimestamp () {
	var date	= new Date();
	var hour	= date.getHours();
	var ampm	= 'am';
	var minute	= ('0' + date.getMinutes()).slice(-2);

	if (hour >= 12) {
		hour	-= 12;
		ampm	= 'pm';
	}
	if (hour == 0) {
		hour	= 12;
	}

	return hour + ':' + minute + ampm;
}


function getUrlState () {
	var split	= document.location.pathname.split('/');

	var a	= split.slice(-1)[0];
	var b	= split.slice(-2)[0];

	if (!a && b) {
		return b;
	}
	else {
		return a;
	}
}


function pushNotFound () {
	pushState('/404');
}


function pushState (path, shouldReplace, shouldNotProcess) {
	if (shouldReplace && isHistoryAvailable && history.replaceState) {
		history.replaceState({}, '', path);
	}
	else if (isHistoryAvailable && history.pushState) {
		history.pushState({}, '', path);
	}
	else if (shouldReplace) {
		document.location.replace(path);
		return;
	}
	else {
		document.location.pathname	= path;
		return;
	}

	if (!shouldNotProcess) {
		processUrlState();
	}
}




var userAgent	= navigator.userAgent.toLowerCase();

var isTouch		= (function () {
	try {
		document.createEvent('TouchEvent');
		return true;
	}
	catch (e) {
		return false;
	}
}());

var isAndroid	= /android/.test(userAgent);
var isIOS		= /ipad|iphone|ipod/.test(userAgent);
var isWP		= /iemobile/.test(userAgent);
var isWebOS		= /webos/.test(userAgent);
var isBB		= /blackberry/.test(userAgent);
var isOperaMini	= /opera mini/.test(userAgent);

var isMobile	= isAndroid || isIOS || isWP || isWebOS || isBB || isOperaMini;

var isFFMobile	=
	/fennec/.test(userAgent) ||
	(/firefox/.test(userAgent) && (isMobile || /mobile/.test(userAgent) || /tablet/.test(userAgent))
);
isMobile		= isMobile || isFFMobile;

var isTablet	= isMobile && window.outerWidth > 767;

var platformString	= isMobile ? 'mobile' : 'desktop';

$(function () {
	$('.' + platformString + '-only [deferred-src], [deferred-src].' + platformString + '-only').
		each(function () {
			var $this	= $(this);
			$this.attr('src', $this.attr('deferred-src'));
		})
	;

	$('[on-enterpress]').each(function () {
		var $this			= $(this);
		var enterpressOnly	= $this.attr('enterpress-only');

		if (!enterpressOnly || enterpressOnly == platformString) {
			var onenterpress	= $this.attr('on-enterpress');

			$this.keypress(function (e) {
				if (e.keyCode == 13 && !e.shiftKey) {
					if (onenterpress) {
						eval(onenterpress);
						e.preventDefault();
					}
				}
			});
		}
	});

	['click', 'change'].forEach(function (eventName) {
		var attribute	= 'on-' + eventName;

		$('[' + attribute + ']').each(function () {
			var $this	= $(this);

			$this.on(eventName, function () {
				eval($this.attr(attribute));
			});
		});
	});

	$('button > a').each(function () {
		var $this	= $(this);
		var $button	= $this.parent();

		$this.css('pointer-events', 'none');

		$button.click(function () {
			$this[0].click();
		});
	});
});


/* Trigger event loops from Web Worker instead of setTimeout (http://stackoverflow.com/a/12522580/459881) */
var tickFunctions	= [];

function makeWorker (f, vars) {
	var s	= f.toString();
	s		= s.slice(s.indexOf('{') + 1, s.lastIndexOf('}'));

	if (vars) {
		for (var k in vars) {
			s	= s.replace(new RegExp(k, 'g', vars[k]));
		}
	}

	var blob, worker;

	try {
		blob	= new Blob([s], {type: 'application/javascript'});
	}
	catch (e) {
		window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
		blob	= new BlobBuilder();
		blob.append(s);
		blob	= blob.getBlob();
	}

	try {
		worker	= new Worker(URL.createObjectURL(blob));
	}
	catch (e) {
		worker	= new Worker('js/workerHelper.js');
		worker.postMessage(s);
	}

	return worker;
}

function onTick (f) {
	tickFunctions.push(f);

	if (tickFunctions.length == 1) {
		var worker, processTicksLock;

		function processTicks () {
			if (!processTicksLock) {
				processTicksLock	= true;

				var now	= Date.now();

				try {
					for (var i = 0 ; i < tickFunctions.length ; ++i) {
						tickFunctions[i](now);
					}
				}
				finally {
					processTicksLock	= false;
				}
			}
		}

		function processTickEventLoop () {
			processTicks();
			setTimeout(processTickEventLoop, 25);
		}

		function processTickWorker (interval) {
			worker	= makeWorker(function () {
				setInterval(function () {
					postMessage({eventName: 'tick'});
				}, interval);
			}, {
				interval: interval
			});

			worker.onmessage	= processTicks;
		}


		if (isMobile) {
			processTickEventLoop();
			setTimeout(function () { processTickWorker(2500) }, 10000);
		}
		else {
			processTickWorker(50);
		}
	}
}


/* jQuery plugin to get element bounds */
$.fn.bounds	= function () {
	var $this	= $(this);
	var bounds	= $this.offset();

	bounds.bottom	= bounds.top + $this.outerHeight();
	bounds.right	= bounds.left + $this.outerWidth();

	return bounds;
};
