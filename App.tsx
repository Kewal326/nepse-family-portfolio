import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  StatusBar as RNStatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  WebView,
  type FileDownload,
  type WebViewMessageEvent,
} from 'react-native-webview';

type Holding = {
  accountId?: string;
  symbol: string;
  company: string;
  quantity: number;
  averageCost: number;
  ltp: number;
  dayChangePercent?: number;
  source: string;
  raw?: unknown;
};

type SortOption = 'alphabetical' | 'profit-value' | 'profit-pct' | 'loss-value' | 'loss-pct' | 'invested' | 'value';

type NepseIndexData = {
  currentValue: number;
  pointChange: number;
  percentChange: number;
};

type PriceQuote = {
  symbol: string;
  ltp: number;
  dayChangePercent?: number;
  raw?: unknown;
};

type CostBasis = {
  accountId?: string;
  symbol: string;
  calculatedQuantity: number;
  averageCost: number;
  totalCost: number;
  raw?: Record<string, unknown>;
};

type PurchaseLot = {
  accountId?: string;
  symbol: string;
  transactionDate: string;
  quantity: number;
  rate: number;
  purchaseSource: string;
  purchasePrice: number;
  totalCost: number;
  remarks: string;
  raw?: Record<string, unknown>;
};

type Account = {
  id: string;
  name: string;
  dematMasked: string;
  boid?: string;
  clientCode?: string;
  username?: string;
  holdings: number;
  syncedAt: string;
};

type ExtractedTable = {
  index: number;
  headers: string[];
  rows: Array<Record<string, string | string[]>>;
};

type ExtractedHoldingCandidate = {
  symbol?: string;
  company?: string;
  quantity?: string;
  averageCost?: string;
  ltp?: string;
  raw: Record<string, string | string[]>;
};

type ExtractionPayload = {
  type: 'MEROSHARE_EXTRACT';
  url: string;
  title: string;
  capturedAt: string;
  textSample: string;
  keywordSnippets?: Array<{ keyword: string; snippet: string }>;
  interactiveElements?: Array<Record<string, string | number | boolean>>;
  tables: ExtractedTable[];
  candidateHoldings: ExtractedHoldingCandidate[];
};

type ParsedReport = {
  fileName: string;
  localUri: string;
  rawText: string;
  rows: Array<Record<string, string | string[]>>;
  holdings: Holding[];
  costBasis: CostBasis[];
  purchaseLots: PurchaseLot[];
};

type FileDownloadEvent = NativeSyntheticEvent<FileDownload>;

type MeroShareClickPayload = {
  type: 'MEROSHARE_CLICK';
  url: string;
  clickedAt: string;
  element: Record<string, string | number | boolean>;
};

type MeroShareBlobDownloadPayload = {
  type: 'MEROSHARE_BLOB_DOWNLOAD';
  url: string;
  href: string;
  capturedAt: string;
  fileName: string;
  mimeType: string;
  size: number;
  text: string;
};

type MeroShareBlobErrorPayload = {
  type: 'MEROSHARE_BLOB_DOWNLOAD_ERROR';
  url: string;
  href: string;
  capturedAt: string;
  message: string;
};

type MeroShareAutoScanItemPayload = {
  type: 'MEROSHARE_AUTOSCAN_ITEM';
  url: string;
  capturedAt: string;
  symbol: string;
  index: number;
  total: number;
  tables: ExtractedTable[];
};

type MeroShareAutoScanDonePayload = {
  type: 'MEROSHARE_AUTOSCAN_DONE';
  url: string;
  capturedAt: string;
  total: number;
};

type MeroShareAutoScanErrorPayload = {
  type: 'MEROSHARE_AUTOSCAN_ERROR';
  url: string;
  capturedAt: string;
  symbol?: string;
  index?: number;
  total?: number;
  message: string;
};

type MeroShareAutoScanDebugPayload = {
  type: 'MEROSHARE_AUTOSCAN_DEBUG';
  url: string;
  capturedAt: string;
  symbol?: string;
  step: string;
  details?: Record<string, string | number | boolean | null>;
};

type MeroShareFormInspectionPayload = {
  type: 'MEROSHARE_FORM_INSPECT';
  url: string;
  title: string;
  capturedAt: string;
  textSample: string;
  elements: unknown[];
  fieldGroups: unknown[];
};

type MeroShareApiProbePayload = {
  type: 'MEROSHARE_API_PROBE';
  url: string;
  capturedAt: string;
  symbol: string;
  records: unknown[];
};

type AutoScanSummary = {
  symbol: string;
  status: 'idle' | 'running' | 'success' | 'done' | 'error';
  message: string;
  tableCount: number;
  waccCount: number;
  lotCount: number;
  lastStep?: string;
};

type MeroShareNetworkLogPayload = {
  type: 'MEROSHARE_NETWORK_LOG';
  pageUrl: string;
  capturedAt: string;
  direction: 'request' | 'response' | 'error';
  transport: 'fetch' | 'xhr';
  method: string;
  requestUrl: string;
  status?: number;
  requestBody?: string;
  responseText?: string;
  message?: string;
};

type MeroShareNetworkSnapshotPayload = {
  type: 'MEROSHARE_NETWORK_SNAPSHOT';
  pageUrl: string;
  capturedAt: string;
  reason: string;
  records: MeroShareNetworkLogPayload[];
};

type ApiProbeSummary = {
  status: 'idle' | 'running' | 'success' | 'empty' | 'error';
  symbol: string;
  message: string;
  recordCount: number;
  responseCount: number;
  endpoints: string[];
  capturedAt?: string;
};

type MeroShareDirectApiResultPayload = {
  type: 'MEROSHARE_DIRECT_API_RESULT';
  url: string;
  capturedAt: string;
  symbol: string;
  account: {
    dematMasked: string;
    boid: string;
    clientCode: string;
    username: string;
    name?: string;
  };
  ownDetailStatus: number;
  waccStatus: number;
  wacc: unknown;
  responseShape: string;
  itemCount: number;
  holdingQuantity?: number;
  index: number;
  total: number;
};

type MeroSharePortfolioApiResultPayload = {
  type: 'MEROSHARE_PORTFOLIO_API_RESULT';
  url: string;
  capturedAt: string;
  account: {
    dematMasked: string;
    boid: string;
    clientCode: string;
    username: string;
    name?: string;
  };
  pageCount: number;
  totalItems: number;
  holdings: unknown[];
};

type MeroShareDirectApiErrorPayload = {
  type: 'MEROSHARE_DIRECT_API_ERROR';
  url: string;
  capturedAt: string;
  symbol: string;
  step: string;
  message: string;
  status?: number;
  responseText?: string;
  index?: number;
  total?: number;
};

type DirectApiSummary = {
  status: 'idle' | 'running' | 'success' | 'error';
  symbol: string;
  message: string;
  dematMasked: string;
  waccStatus?: number;
  responseShape?: string;
  itemCount?: number;
  total?: number;
  completed?: number;
  failed?: number;
  capturedAt?: string;
};

type DirectSyncMode = 'single' | 'full' | 'auto';

type PersistedPortfolioState = {
  syncedAt: string;
  accounts?: Account[];
  activeAccountId?: string | null;
  syncedHoldings: Holding[];
  costBasisRecords: CostBasis[];
  purchaseLotRecords: PurchaseLot[];
  lastCapture: string;
  priceSyncedAt?: string | null;
};

const demoHoldings: Holding[] = [
  {
    symbol: 'NABIL',
    company: 'Nabil Bank Limited',
    quantity: 180,
    averageCost: 423.25,
    ltp: 548,
    source: 'Demo: IPO + Market',
  },
  {
    symbol: 'HDL',
    company: 'Himalayan Distillery Limited',
    quantity: 35,
    averageCost: 1570,
    ltp: 1882,
    source: 'Demo: Market',
  },
  {
    symbol: 'NICA',
    company: 'NIC Asia Bank Limited',
    quantity: 260,
    averageCost: 612.4,
    ltp: 489,
    source: 'Demo: Bonus adjusted',
  },
];

const MEROSHARE_URL = 'https://meroshare.cdsc.com.np/';
const NEPSE_OFFICIAL_API_BASE_URL = 'https://www.nepalstock.com/api';
const NEPSE_UNOFFICIAL_PRICE_API_BASE_URL = 'https://nepseapi.surajrimal.dev';
const NEPSE_UNOFFICIAL_PRICE_API_ENDPOINTS = ['/LiveMarket', '/PriceVolume', '/TradeTurnoverTransactionSubindices'];
const PORTFOLIO_CACHE_URI = `${FileSystem.documentDirectory || ''}nepse-portfolio-cache-v1.json`;
const ANALYSIS_EXPORT_DIR_URI = `${FileSystem.documentDirectory || ''}analysis-exports/`;
const MAX_MEROSHARE_LOG_CHARS = 6000;
const VERBOSE_MEROSHARE_LOGS = false;
const NEPSE_TOKEN_STRIP_TABLE = [
  5, 8, 4, 7, 9, 4, 6, 9, 5, 5,
  6, 5, 3, 5, 4, 4, 9, 6, 6, 8,
  8, 6, 8, 6, 5, 8, 4, 9, 5, 9,
  8, 5, 3, 4, 7, 7, 4, 7, 3, 9,
];
const NEPSE_DUMMY_DATA = [
  147, 117, 239, 143, 157, 312, 161, 612, 512, 804,
  411, 527, 170, 511, 421, 667, 764, 621, 301, 106,
  133, 793, 411, 511, 312, 423, 344, 346, 653, 758,
  342, 222, 236, 811, 711, 611, 122, 447, 128, 199,
  183, 135, 489, 703, 800, 745, 152, 863, 134, 211,
  142, 564, 375, 793, 212, 153, 138, 153, 648, 611,
  151, 649, 318, 143, 117, 756, 119, 141, 717, 113,
  112, 146, 162, 660, 693, 261, 362, 354, 251, 641,
  157, 178, 631, 192, 734, 445, 192, 883, 187, 122,
  591, 731, 852, 384, 565, 596, 451, 772, 624, 691,
];

const MEROSHARE_NETWORK_LOGGER_SCRIPT = `
(function () {
  function clean(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim();
  }

  function safeSlice(value) {
    return clean(value).slice(0, 1800);
  }

  function shouldSkipSensitive(url, body) {
    var haystack = String(url || '') + ' ' + String(body || '');
    return /login|password|username|captcha|otp|pin|token|authorization/i.test(haystack);
  }

  function absoluteRequestUrl(url) {
    try {
      return new URL(String(url || ''), window.location.href).href;
    } catch (error) {
      return String(url || '');
    }
  }

  function looksRelevant(url, body, responseText) {
    var pageUrl = String(window.location.href || '').toLowerCase();
    var absoluteUrl = absoluteRequestUrl(url);
    var haystack = [
      absoluteUrl,
      body,
      responseText,
      pageUrl.indexOf('/purchase') >= 0 ? 'purchase-page' : ''
    ].join(' ').toLowerCase();

    if (shouldSkipSensitive(url, body)) return false;
    if (
      absoluteUrl.indexOf('meroshare.cdsc.com.np') < 0 &&
      absoluteUrl.indexOf('webbackend.cdsc.com.np') < 0
    ) {
      return false;
    }

    return [
      'purchase',
      'wacc',
      'capital',
      'source',
      'script',
      'scrip',
      'share',
      'holding'
    ].some(function (keyword) {
      return haystack.indexOf(keyword) >= 0;
    });
  }

  function rememberNetworkRecord(record) {
    window.__nepsePortfolioNetworkRecords = window.__nepsePortfolioNetworkRecords || [];
    window.__nepsePortfolioNetworkRecords.push(record);

    if (window.__nepsePortfolioNetworkRecords.length > 80) {
      window.__nepsePortfolioNetworkRecords.shift();
    }
  }

  function postNetwork(payload) {
    try {
      var record = Object.assign({
        type: 'MEROSHARE_NETWORK_LOG',
        pageUrl: window.location.href,
        capturedAt: new Date().toISOString()
      }, payload);

      rememberNetworkRecord(record);
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({
        type: 'MEROSHARE_NETWORK_LOG',
        pageUrl: window.location.href,
        capturedAt: new Date().toISOString()
      }, payload)));
    } catch (error) {
      // Do not let diagnostics break MeroShare.
    }
  }

  window.__nepsePortfolioResetNetworkRecords = function () {
    window.__nepsePortfolioNetworkRecords = [];
  };

  window.__nepsePortfolioGetNetworkRecords = function () {
    return (window.__nepsePortfolioNetworkRecords || []).slice();
  };

  window.__nepsePortfolioPostNetworkSnapshot = function (reason) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'MEROSHARE_NETWORK_SNAPSHOT',
        pageUrl: window.location.href,
        capturedAt: new Date().toISOString(),
        reason: reason || 'manual',
        records: window.__nepsePortfolioGetNetworkRecords()
      }));
    } catch (error) {}
  };

  if (window.__nepsePortfolioNetworkLoggerInstalled) {
    true;
    return;
  }

  window.__nepsePortfolioNetworkLoggerInstalled = true;

  if (window.fetch && !window.__nepsePortfolioOriginalFetch) {
    window.__nepsePortfolioOriginalFetch = window.fetch;
    window.fetch = function (input, init) {
      var requestUrl = absoluteRequestUrl(typeof input === 'string' ? input : String(input && input.url ? input.url : ''));
      var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var requestBody = init && init.body ? safeSlice(init.body) : '';

      if (looksRelevant(requestUrl, requestBody, '')) {
        postNetwork({
          direction: 'request',
          transport: 'fetch',
          method: method,
          requestUrl: requestUrl,
          requestBody: requestBody
        });
      }

      return window.__nepsePortfolioOriginalFetch.apply(this, arguments)
        .then(function (response) {
          var clonedResponse = response.clone();
          clonedResponse.text()
            .then(function (text) {
              if (looksRelevant(requestUrl, requestBody, text)) {
                postNetwork({
                  direction: 'response',
                  transport: 'fetch',
                  method: method,
                  requestUrl: requestUrl,
                  status: response.status,
                  requestBody: requestBody,
                  responseText: safeSlice(text)
                });
              }
            })
            .catch(function () {});

          return response;
        })
        .catch(function (error) {
          if (looksRelevant(requestUrl, requestBody, '')) {
            postNetwork({
              direction: 'error',
              transport: 'fetch',
              method: method,
              requestUrl: requestUrl,
              requestBody: requestBody,
              message: String(error && error.message ? error.message : error)
            });
          }
          throw error;
        });
    };
  }

  if (window.XMLHttpRequest && !window.__nepsePortfolioXhrPatched) {
    window.__nepsePortfolioXhrPatched = true;
    var originalOpen = window.XMLHttpRequest.prototype.open;
    var originalSend = window.XMLHttpRequest.prototype.send;

    window.XMLHttpRequest.prototype.open = function (method, url) {
      this.__nepsePortfolioMethod = String(method || 'GET').toUpperCase();
      this.__nepsePortfolioUrl = absoluteRequestUrl(url);
      return originalOpen.apply(this, arguments);
    };

    window.XMLHttpRequest.prototype.send = function (body) {
      var xhr = this;
      var requestBody = body ? safeSlice(body) : '';
      var requestUrl = xhr.__nepsePortfolioUrl || '';
      var method = xhr.__nepsePortfolioMethod || 'GET';

      if (looksRelevant(requestUrl, requestBody, '')) {
        postNetwork({
          direction: 'request',
          transport: 'xhr',
          method: method,
          requestUrl: requestUrl,
          requestBody: requestBody
        });
      }

      xhr.addEventListener('loadend', function () {
        var responseText = '';
        try {
          responseText = typeof xhr.responseText === 'string' ? xhr.responseText : '';
        } catch (error) {
          responseText = '';
        }

        if (looksRelevant(requestUrl, requestBody, responseText)) {
          postNetwork({
            direction: 'response',
            transport: 'xhr',
            method: method,
            requestUrl: requestUrl,
            status: xhr.status,
            requestBody: requestBody,
            responseText: safeSlice(responseText)
          });
        }
      });

      return originalSend.apply(this, arguments);
    };
  }
})();
true;
`;

const MEROSHARE_NETWORK_SNAPSHOT_SCRIPT = `
(function () {
  if (window.__nepsePortfolioPostNetworkSnapshot) {
    window.__nepsePortfolioPostNetworkSnapshot('manual');
  } else {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'MEROSHARE_NETWORK_SNAPSHOT',
      pageUrl: window.location.href,
      capturedAt: new Date().toISOString(),
      reason: 'manual',
      records: []
    }));
  }
})();
true;
`;

function createMeroShareDirectApiScript(symbols: string | string[]) {
  const symbolList = Array.isArray(symbols) ? symbols : [symbols];
  const safeSymbols = JSON.stringify(symbolList.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));

  return `
(function () {
  var symbols = ${safeSymbols};
  var backendBaseUrl = 'https://webbackend.cdsc.com.np/api';

  function post(payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  function clean(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim();
  }

  function safeText(value) {
    return clean(value).slice(0, 1000);
  }

  function maskDemat(value) {
    var text = clean(value);
    if (text.length <= 4) return text;
    return text.slice(0, 4) + '********' + text.slice(-4);
  }

  function jsonOrText(response) {
    return response.text().then(function (text) {
      try {
        return JSON.parse(text);
      } catch (error) {
        return { rawText: text };
      }
    });
  }

  function storageText() {
    var parts = [];
    [window.localStorage, window.sessionStorage].forEach(function (storage) {
      if (!storage) return;
      for (var index = 0; index < storage.length; index += 1) {
        var key = storage.key(index);
        if (!key) continue;
        var value = '';
        try {
          value = storage.getItem(key) || '';
        } catch (error) {
          value = '';
        }
        parts.push(key + '=' + value);
      }
    });
    return parts.join('\\n');
  }

  function findJwtToken() {
    var text = storageText();
    var match = text.match(/eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+/);
    return match ? match[0] : '';
  }

  function responseCount(value) {
    if (Array.isArray(value)) return value.length;
    if (!value || typeof value !== 'object') return 0;
    var objectValue = value;
    var candidateKeys = ['data', 'content', 'detail', 'details', 'result', 'results', 'items', 'rows'];
    for (var index = 0; index < candidateKeys.length; index += 1) {
      var candidate = objectValue[candidateKeys[index]];
      if (Array.isArray(candidate)) return candidate.length;
    }
    return Object.keys(objectValue).length ? 1 : 0;
  }

  function responseShape(value) {
    if (Array.isArray(value)) return 'array';
    if (!value || typeof value !== 'object') return typeof value;
    return 'object: ' + Object.keys(value).slice(0, 8).join(', ');
  }

  function discoverSymbolsFromPage() {
    var discoveredSymbols = [];
    var scriptInput = document.querySelector('input#script[list], input[name="script"][list]');
    var datalistId = scriptInput ? scriptInput.getAttribute('list') : '';
    var datalist = datalistId ? document.getElementById(datalistId) : document.querySelector('datalist#browsers');

    Array.prototype.slice.call(datalist ? datalist.querySelectorAll('option') : []).forEach(function (option) {
      var value = clean(option.value || option.innerText || option.textContent).toUpperCase();
      if (value && discoveredSymbols.indexOf(value) < 0) {
        discoveredSymbols.push(value);
      }
    });

    return discoveredSymbols;
  }

  async function fetchPortfolioHoldings(headers, ownDetail, demat) {
    var page = 1;
    var size = 200;
    var allHoldings = [];
    var totalItems = 0;
    var clientCode = clean(ownDetail && ownDetail.clientCode);
    var lastPortfolioError = null;

    async function requestPortfolio(payload) {
      var response = await fetch(backendBaseUrl + '/meroShareView/myPortfolio/', {
        method: 'POST',
        headers: Object.assign({}, headers, {
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify(payload)
      });
      var body = await jsonOrText(response);
      return {
        response: response,
        body: body,
        payload: payload
      };
    }

    async function fetchPortfolioPage(pageNumber) {
      var basePayload = {
        sortBy: 'script',
        demat: [demat],
        clientCode: clientCode,
        page: pageNumber,
        size: size,
        sortAsc: true
      };
      var variants = [
        basePayload,
        Object.assign({}, basePayload, { clientCode: Number(clientCode) || clientCode }),
        Object.assign({}, basePayload, { demat: demat }),
        Object.assign({}, basePayload, { page: pageNumber - 1 })
      ];

      for (var variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
        var result = await requestPortfolio(variants[variantIndex]);
        if (result.response.ok) {
          return result;
        }
        lastPortfolioError = result;
      }

      return lastPortfolioError;
    }

    while (page <= 50) {
      var portfolioResult = await fetchPortfolioPage(page);
      var portfolioResponse = portfolioResult && portfolioResult.response;
      var portfolio = portfolioResult && portfolioResult.body;

      if (!portfolioResponse || !portfolioResponse.ok) {
        post({
          type: 'MEROSHARE_DIRECT_API_ERROR',
          url: window.location.href,
          capturedAt: new Date().toISOString(),
          symbol: '',
          step: 'portfolio',
          status: portfolioResponse ? portfolioResponse.status : 0,
          message: 'Portfolio API failed with HTTP ' + (portfolioResponse ? portfolioResponse.status : 'unknown'),
          responseText: safeText(JSON.stringify({
            response: portfolio,
            request: portfolioResult && portfolioResult.payload ? Object.assign({}, portfolioResult.payload, {
              demat: Array.isArray(portfolioResult.payload.demat) ? portfolioResult.payload.demat.map(maskDemat) : maskDemat(portfolioResult.payload.demat)
            }) : {}
          }))
        });
        return [];
      }

      var pageHoldings = Array.isArray(portfolio && portfolio.meroShareMyPortfolio)
        ? portfolio.meroShareMyPortfolio
        : [];
      totalItems = Number(portfolio && portfolio.totalItems ? portfolio.totalItems : pageHoldings.length);
      allHoldings = allHoldings.concat(pageHoldings);

      if (!pageHoldings.length || allHoldings.length >= totalItems || pageHoldings.length < size) {
        post({
          type: 'MEROSHARE_PORTFOLIO_API_RESULT',
          url: window.location.href,
          capturedAt: new Date().toISOString(),
          account: {
            dematMasked: maskDemat(demat),
            boid: clean(ownDetail && ownDetail.boid),
            clientCode: clientCode,
            username: clean(ownDetail && ownDetail.username),
            name: clean(ownDetail && ownDetail.name)
          },
          pageCount: page,
          totalItems: totalItems,
          holdings: allHoldings
        });
        return allHoldings;
      }

      page += 1;
    }

    post({
      type: 'MEROSHARE_DIRECT_API_ERROR',
      url: window.location.href,
      capturedAt: new Date().toISOString(),
      symbol: '',
      step: 'portfolio',
      message: 'Portfolio API pagination exceeded 50 pages.'
    });
    return [];
  }

  async function run() {
    try {
      var token = findJwtToken();
      if (!token) {
        throw new Error('Could not find MeroShare auth token in browser storage after login.');
      }

      var headers = {
        Accept: 'application/json, text/plain, */*',
        Authorization: token
      };

      var ownDetailResponse = await fetch(backendBaseUrl + '/meroShare/ownDetail/', {
        method: 'GET',
        headers: headers
      });
      var ownDetail = await jsonOrText(ownDetailResponse);

      if (!ownDetailResponse.ok) {
        post({
          type: 'MEROSHARE_DIRECT_API_ERROR',
          url: window.location.href,
          capturedAt: new Date().toISOString(),
          symbol: symbols[0] || '',
          step: 'ownDetail',
          status: ownDetailResponse.status,
          message: 'ownDetail API failed with HTTP ' + ownDetailResponse.status,
          responseText: safeText(JSON.stringify(ownDetail))
        });
        return;
      }

      var demat = clean(ownDetail && ownDetail.demat);
      if (!demat) {
        throw new Error('ownDetail API succeeded but did not return demat.');
      }

      var holdingQuantityBySymbol = {};
      if (!symbols.length) {
        var portfolioHoldings = await fetchPortfolioHoldings(headers, ownDetail, demat);
        portfolioHoldings.forEach(function (holding) {
          var holdingSymbol = clean(holding && holding.script).toUpperCase();
          if (holdingSymbol) {
            holdingQuantityBySymbol[holdingSymbol] = Number(holding && holding.currentBalance ? holding.currentBalance : 0) || 0;
          }
        });
        symbols = portfolioHoldings.map(function (holding) {
          return clean(holding && holding.script).toUpperCase();
        }).filter(Boolean);
      }

      if (!symbols.length) {
        symbols = discoverSymbolsFromPage();
      }

      if (!symbols.length) {
        throw new Error('No symbols available after portfolio API sync or page symbol discovery.');
      }

      for (var index = 0; index < symbols.length; index += 1) {
        var symbol = symbols[index];
        var waccResponse = await fetch(backendBaseUrl + '/myPurchase/search/wacc/', {
          method: 'POST',
          headers: Object.assign({}, headers, {
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            demat: demat,
            scrip: symbol
          })
        });
        var wacc = await jsonOrText(waccResponse);

        if (!waccResponse.ok) {
          post({
            type: 'MEROSHARE_DIRECT_API_ERROR',
            url: window.location.href,
            capturedAt: new Date().toISOString(),
            symbol: symbol,
            step: 'wacc',
            status: waccResponse.status,
            message: 'WACC API failed with HTTP ' + waccResponse.status,
            responseText: safeText(JSON.stringify(wacc)),
            index: index + 1,
            total: symbols.length
          });
          continue;
        }

        post({
          type: 'MEROSHARE_DIRECT_API_RESULT',
          url: window.location.href,
          capturedAt: new Date().toISOString(),
          symbol: symbol,
          account: {
            dematMasked: maskDemat(demat),
            boid: clean(ownDetail && ownDetail.boid),
            clientCode: clean(ownDetail && ownDetail.clientCode),
            username: clean(ownDetail && ownDetail.username),
            name: clean(ownDetail && ownDetail.name)
          },
          ownDetailStatus: ownDetailResponse.status,
          waccStatus: waccResponse.status,
          wacc: wacc,
          responseShape: responseShape(wacc),
          itemCount: responseCount(wacc),
          holdingQuantity: holdingQuantityBySymbol[symbol] || 0,
          index: index + 1,
          total: symbols.length
        });
      }
    } catch (error) {
      post({
        type: 'MEROSHARE_DIRECT_API_ERROR',
        url: window.location.href,
        capturedAt: new Date().toISOString(),
        symbol: symbols[0] || '',
        step: 'direct-api',
        message: String(error && error.message ? error.message : error)
      });
    }
  }

  run();
})();
true;
`;
}

const EXTRACT_MEROSHARE_SCRIPT = `
(function () {
  function clean(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim();
  }

  function getCells(row) {
    return Array.prototype.slice.call(row.querySelectorAll('th,td')).map(function (cell) {
      return clean(cell.innerText || cell.textContent);
    }).filter(Boolean);
  }

  function keyFor(header, index) {
    return clean(header) || 'column_' + (index + 1);
  }

  function pick(row, labels) {
    var keys = Object.keys(row);
    for (var i = 0; i < labels.length; i += 1) {
      var label = labels[i].toLowerCase();
      var key = keys.find(function (item) {
        return item.toLowerCase().indexOf(label) >= 0;
      });
      if (key && typeof row[key] === 'string') {
        return row[key];
      }
    }
    return '';
  }

  function inferSymbol(row) {
    var fromLabel = pick(row, ['scrip', 'symbol', 'isin', 'security', 'company']);
    if (fromLabel) {
      var directMatch = fromLabel.match(/[A-Z][A-Z0-9.]{1,12}/);
      if (directMatch) return directMatch[0];
    }

    var cells = row._cells || [];
    for (var i = 0; i < cells.length; i += 1) {
      var match = String(cells[i]).match(/^[A-Z][A-Z0-9.]{1,12}$/);
      if (match) return match[0];
    }
    return '';
  }

  function describeElement(element, index) {
    var rect = element.getBoundingClientRect();
    var style = window.getComputedStyle(element);
    var type = element.getAttribute('type') || '';
    var id = element.id || '';
    var name = element.getAttribute('name') || '';
    var sensitive = /password|username|login|client|captcha|pin|otp/i.test([type, id, name].join(' '));
    return {
      index: index,
      tag: element.tagName,
      type: type,
      text: sensitive ? '[redacted]' : clean(element.innerText || element.textContent || element.value || element.getAttribute('aria-label') || element.title),
      href: element.href || element.getAttribute('href') || '',
      download: element.getAttribute('download') || '',
      id: sensitive ? '[redacted]' : id,
      name: sensitive ? '[redacted]' : name,
      classes: element.className || '',
      disabled: Boolean(element.disabled || element.getAttribute('disabled') !== null || element.getAttribute('aria-disabled') === 'true'),
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  function findKeywordSnippets() {
    var bodyText = clean(document.body ? document.body.innerText : '');
    var lowerText = bodyText.toLowerCase();
    var keywords = [
      'wacc',
      'weighted',
      'average',
      'cost',
      'purchase',
      'source',
      'portfolio',
      'holding',
      'transaction',
      'capital gain',
      'edisb',
      'bonus',
      'right share',
      'ipo'
    ];

    return keywords.map(function (keyword) {
      var index = lowerText.indexOf(keyword);
      if (index < 0) return null;
      return {
        keyword: keyword,
        snippet: bodyText.slice(Math.max(0, index - 90), index + 180)
      };
    }).filter(Boolean);
  }

  function readBlobDownload(anchor, event) {
    var href = anchor.href || anchor.getAttribute('href') || '';
    if (!href || href.indexOf('blob:') !== 0) return false;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    fetch(href)
      .then(function (response) {
        return response.blob();
      })
      .then(function (blob) {
        var reader = new FileReader();
        reader.onload = function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'MEROSHARE_BLOB_DOWNLOAD',
            url: window.location.href,
            href: href,
            capturedAt: new Date().toISOString(),
            fileName: anchor.getAttribute('download') || 'meroshare-report.csv',
            mimeType: blob.type || '',
            size: blob.size || 0,
            text: String(reader.result || '')
          }));
        };
        reader.onerror = function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'MEROSHARE_BLOB_DOWNLOAD_ERROR',
            url: window.location.href,
            href: href,
            capturedAt: new Date().toISOString(),
            message: 'Unable to read blob download with FileReader'
          }));
        };
        reader.readAsText(blob);
      })
      .catch(function (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'MEROSHARE_BLOB_DOWNLOAD_ERROR',
          url: window.location.href,
          href: href,
          capturedAt: new Date().toISOString(),
          message: String(error && error.message ? error.message : error)
        }));
      });

    return true;
  }

  if (!window.__nepsePortfolioClickLoggerInstalled) {
    window.__nepsePortfolioClickLoggerInstalled = true;
    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest
        ? event.target.closest('button,a,input,[role="button"],.btn')
        : event.target;
      if (!target) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'MEROSHARE_CLICK',
        url: window.location.href,
        clickedAt: new Date().toISOString(),
        element: describeElement(target, -1)
      }));

      if (target.tagName === 'A') {
        readBlobDownload(target, event);
      }
    }, true);
  }

  var tables = Array.prototype.slice.call(document.querySelectorAll('table')).map(function (table, tableIndex) {
    var tableRows = Array.prototype.slice.call(table.querySelectorAll('tr'));
    var headerCells = Array.prototype.slice.call(table.querySelectorAll('thead tr th')).map(function (header) {
      return clean(header.innerText || header.textContent);
    }).filter(Boolean);

    if (!headerCells.length && tableRows.length) {
      headerCells = getCells(tableRows[0]);
    }

    var bodyRows = tableRows.filter(function (row, rowIndex) {
      if (rowIndex === 0 && headerCells.length) return false;
      return getCells(row).length > 0;
    });

    var rows = bodyRows.map(function (row) {
      var cells = getCells(row);
      var rowObject = { _cells: cells };
      cells.forEach(function (cell, cellIndex) {
        rowObject[keyFor(headerCells[cellIndex], cellIndex)] = cell;
      });
      return rowObject;
    });

    return {
      index: tableIndex,
      headers: headerCells,
      rows: rows
    };
  });

  var candidateHoldings = [];
  tables.forEach(function (table) {
    table.rows.forEach(function (row) {
      var symbol = inferSymbol(row);
      var quantity = pick(row, ['current balance', 'free balance', 'balance', 'quantity', 'qty', 'units']);
      var averageCost = pick(row, ['wacc', 'average', 'avg', 'cost']);
      var ltp = pick(row, ['ltp', 'last traded', 'market price', 'price']);
      var company = pick(row, ['company', 'scrip', 'security']);

      if (symbol || quantity || averageCost || ltp) {
        candidateHoldings.push({
          symbol: symbol,
          company: company,
          quantity: quantity,
          averageCost: averageCost,
          ltp: ltp,
          raw: row
        });
      }
    });
  });

  var interactiveElements = Array.prototype.slice.call(
    document.querySelectorAll('button,a,input,[role="button"],.btn')
  ).map(describeElement).filter(function (element) {
    return element.visible && (element.text || element.href || element.type);
  });

  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'MEROSHARE_EXTRACT',
    url: window.location.href,
    title: document.title,
    capturedAt: new Date().toISOString(),
    textSample: clean(document.body ? document.body.innerText : '').slice(0, 1000),
    keywordSnippets: findKeywordSnippets(),
    interactiveElements: interactiveElements,
    tables: tables,
    candidateHoldings: candidateHoldings
  }));
})();
true;
`;

const MEROSHARE_FORM_INSPECTOR_SCRIPT = `
(function () {
  function clean(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim();
  }

  function safeSlice(value, maxLength) {
    return clean(value).slice(0, maxLength || 500);
  }

  function visible(element) {
    var rect = element.getBoundingClientRect();
    var style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function sensitive(element) {
    var haystack = [
      element.getAttribute('type') || '',
      element.id || '',
      element.getAttribute('name') || '',
      element.getAttribute('placeholder') || '',
      element.getAttribute('autocomplete') || ''
    ].join(' ');
    return /password|username|login|client|captcha|pin|otp|token/i.test(haystack);
  }

  function selectorFor(element) {
    if (!element) return '';
    if (element.id) return '#' + element.id;
    var classes = String(element.className || '').split(/\\s+/).filter(Boolean).slice(0, 3);
    return element.tagName.toLowerCase() + (classes.length ? '.' + classes.join('.') : '');
  }

  function sanitizedHtml(element) {
    if (!element) return '';
    var clone = element.cloneNode(true);
    Array.prototype.slice.call(clone.querySelectorAll('input,textarea')).forEach(function (input) {
      if (sensitive(input)) {
        input.setAttribute('value', '[redacted]');
      } else if (input.hasAttribute('value')) {
        input.setAttribute('value', safeSlice(input.getAttribute('value'), 80));
      }
    });
    return safeSlice(clone.outerHTML || '', 1200);
  }

  function describeElement(element, index) {
    var rect = element.getBoundingClientRect();
    var formGroup = element.closest('.form-group, .form-row, .row, form, div');
    var label = '';
    if (element.id) {
      var labelNode = document.querySelector('label[for="' + element.id + '"]');
      label = labelNode ? clean(labelNode.innerText || labelNode.textContent) : '';
    }
    if (!label) {
      label = clean(element.closest('label') ? element.closest('label').innerText : '');
    }

    var elementSensitive = sensitive(element);
    var type = element.getAttribute('type') || '';
    var value = '';
    if (!elementSensitive && 'value' in element) {
      value = safeSlice(element.value, 160);
    }

    return {
      index: index,
      tag: element.tagName,
      selector: selectorFor(element),
      type: type,
      role: element.getAttribute('role') || '',
      id: elementSensitive ? '[redacted]' : element.id || '',
      name: elementSensitive ? '[redacted]' : element.getAttribute('name') || '',
      classes: String(element.className || ''),
      placeholder: elementSensitive ? '[redacted]' : element.getAttribute('placeholder') || '',
      ariaLabel: element.getAttribute('aria-label') || '',
      ariaExpanded: element.getAttribute('aria-expanded') || '',
      disabled: Boolean(element.disabled || element.getAttribute('disabled') !== null || element.getAttribute('aria-disabled') === 'true'),
      visible: visible(element),
      checked: Boolean(element.checked),
      value: elementSensitive ? '[redacted]' : value,
      text: elementSensitive ? '[redacted]' : safeSlice(element.innerText || element.textContent || '', 220),
      label: label,
      parentText: elementSensitive ? '[redacted]' : safeSlice(formGroup ? formGroup.innerText : '', 500),
      parentSelector: selectorFor(formGroup),
      parentHtml: sanitizedHtml(formGroup || element),
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  if (window.location.href.indexOf('/login') >= 0) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'MEROSHARE_FORM_INSPECT',
      url: window.location.href,
      title: document.title,
      capturedAt: new Date().toISOString(),
      textSample: 'Login page skipped by form inspector',
      elements: [],
      fieldGroups: []
    }));
    true;
    return;
  }

  var selectors = [
    'input',
    'select',
    'textarea',
    'button',
    'ng-select',
    '.ng-select',
    '.ng-select-container',
    '.ng-dropdown-panel',
    '.ng-option',
    '.select2-container',
    '.select2-selection',
    '.select2-results__option',
    '[role="combobox"]',
    '[role="option"]',
    '[contenteditable="true"]'
  ].join(',');

  var elements = Array.prototype.slice.call(document.querySelectorAll(selectors))
    .map(describeElement)
    .filter(function (element) {
      return element.visible ||
        /scrip|script|search|select|wacc|purchase|holding/i.test([
          element.text,
          element.label,
          element.parentText,
          element.placeholder,
          element.classes,
          element.id,
          element.name,
          element.role
        ].join(' '));
    });

  var fieldGroups = Array.prototype.slice.call(document.querySelectorAll('.form-group, .form-row, form, .card-body, .tab-content'))
    .map(function (group, index) {
      var rect = group.getBoundingClientRect();
      return {
        index: index,
        selector: selectorFor(group),
        visible: visible(group),
        text: safeSlice(group.innerText || group.textContent || '', 900),
        html: sanitizedHtml(group),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    })
    .filter(function (group) {
      return /scrip|script|search|select|wacc|purchase|holding|pending/i.test(group.text + ' ' + group.html);
    });

  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'MEROSHARE_FORM_INSPECT',
    url: window.location.href,
    title: document.title,
    capturedAt: new Date().toISOString(),
    textSample: safeSlice(document.body ? document.body.innerText : '', 1200),
    elements: elements,
    fieldGroups: fieldGroups
  }));
})();
true;
`;

function createMeroShareAutoScanScript(
  symbols: string[],
  options: { networkProbe?: boolean } = {},
) {
  const safeSymbols = JSON.stringify(symbols);
  const networkProbeEnabled = JSON.stringify(Boolean(options.networkProbe));

  return `
(function () {
  try {
  var symbols = ${safeSymbols};
  var networkProbeEnabled = ${networkProbeEnabled};

  function post(payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  function debug(step, symbol, details) {
    post({
      type: 'MEROSHARE_AUTOSCAN_DEBUG',
      url: window.location.href,
      capturedAt: new Date().toISOString(),
      symbol: symbol || '',
      step: step,
      details: details || {}
    });
  }

  function clean(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim();
  }

  function safeNetworkText(value) {
    return clean(value).slice(0, 1200);
  }

  function shouldSkipNetworkRecord(url, body) {
    var haystack = [url || '', body || ''].join(' ');
    if (/login|password|username|captcha|otp|pin|token|authorization/i.test(haystack)) {
      return true;
    }

    if (!url) return false;

    try {
      var absoluteUrl = new URL(url, window.location.href);
      return absoluteUrl.hostname && absoluteUrl.hostname.indexOf('meroshare.cdsc.com.np') < 0;
    } catch (error) {
      return false;
    }
  }

  function networkRecord(payload) {
    if (!networkProbeEnabled) return;
    if (!window.__nepsePortfolioApiProbeRecords) {
      window.__nepsePortfolioApiProbeRecords = [];
    }

    window.__nepsePortfolioApiProbeRecords.push(Object.assign({
      capturedAt: new Date().toISOString(),
      pageUrl: window.location.href
    }, payload));

    if (window.__nepsePortfolioApiProbeRecords.length > 30) {
      window.__nepsePortfolioApiProbeRecords.shift();
    }
  }

  function resetNetworkProbeRecords() {
    if (!networkProbeEnabled) return;
    window.__nepsePortfolioApiProbeRecords = [];
    if (window.__nepsePortfolioResetNetworkRecords) {
      window.__nepsePortfolioResetNetworkRecords();
    }
  }

  function getNetworkProbeRecords() {
    if (!networkProbeEnabled) return [];
    if (window.__nepsePortfolioGetNetworkRecords) {
      return window.__nepsePortfolioGetNetworkRecords();
    }
    return window.__nepsePortfolioApiProbeRecords
      ? window.__nepsePortfolioApiProbeRecords.slice()
      : [];
  }

  function installNetworkProbe() {
    if (!networkProbeEnabled) {
      return;
    }

    if (window.__nepsePortfolioNetworkLoggerInstalled) {
      debug('networkProbe:globalRecorderAvailable');
      return;
    }

    if (window.__nepsePortfolioApiProbeInstalled) {
      return;
    }

    window.__nepsePortfolioApiProbeInstalled = true;

    if (window.fetch) {
      var originalFetch = window.fetch;
      window.fetch = function (input, init) {
        var requestUrl = typeof input === 'string' ? input : String(input && input.url ? input.url : '');
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        var requestBody = init && init.body ? safeNetworkText(init.body) : '';

        if (!shouldSkipNetworkRecord(requestUrl, requestBody)) {
          networkRecord({
            direction: 'request',
            transport: 'fetch',
            method: method,
            requestUrl: requestUrl,
            requestBody: requestBody
          });
        }

        return originalFetch.apply(this, arguments).then(function (response) {
          var clonedResponse = response.clone();
          clonedResponse.text().then(function (text) {
            if (!shouldSkipNetworkRecord(requestUrl, requestBody)) {
              networkRecord({
                direction: 'response',
                transport: 'fetch',
                method: method,
                requestUrl: requestUrl,
                status: response.status,
                requestBody: requestBody,
                responseText: safeNetworkText(text)
              });
            }
          }).catch(function () {});

          return response;
        });
      };
    }

    if (window.XMLHttpRequest) {
      var originalOpen = window.XMLHttpRequest.prototype.open;
      var originalSend = window.XMLHttpRequest.prototype.send;

      window.XMLHttpRequest.prototype.open = function (method, url) {
        this.__nepsePortfolioApiProbeMethod = String(method || 'GET').toUpperCase();
        this.__nepsePortfolioApiProbeUrl = String(url || '');
        return originalOpen.apply(this, arguments);
      };

      window.XMLHttpRequest.prototype.send = function (body) {
        var xhr = this;
        var requestUrl = xhr.__nepsePortfolioApiProbeUrl || '';
        var method = xhr.__nepsePortfolioApiProbeMethod || 'GET';
        var requestBody = body ? safeNetworkText(body) : '';

        if (!shouldSkipNetworkRecord(requestUrl, requestBody)) {
          networkRecord({
            direction: 'request',
            transport: 'xhr',
            method: method,
            requestUrl: requestUrl,
            requestBody: requestBody
          });
        }

        xhr.addEventListener('loadend', function () {
          var responseText = '';
          try {
            responseText = typeof xhr.responseText === 'string' ? xhr.responseText : '';
          } catch (error) {
            responseText = '';
          }

          if (!shouldSkipNetworkRecord(requestUrl, requestBody)) {
            networkRecord({
              direction: 'response',
              transport: 'xhr',
              method: method,
              requestUrl: requestUrl,
              status: xhr.status,
              requestBody: requestBody,
              responseText: safeNetworkText(responseText)
            });
          }
        });

        return originalSend.apply(this, arguments);
      };
    }
  }

  if (!symbols.length) {
    var discoveredSymbols = [];
    var scriptInputForDiscovery = document.querySelector('input#script[list], input[name="script"][list]');
    var datalistIdForDiscovery = scriptInputForDiscovery ? scriptInputForDiscovery.getAttribute('list') : '';
    var datalistForDiscovery = datalistIdForDiscovery ? document.getElementById(datalistIdForDiscovery) : document.querySelector('datalist#browsers');

    Array.prototype.slice.call(datalistForDiscovery ? datalistForDiscovery.querySelectorAll('option') : []).forEach(function (option) {
      var value = clean(option.value || option.innerText || option.textContent).toUpperCase();
      if (value && discoveredSymbols.indexOf(value) < 0) {
        discoveredSymbols.push(value);
      }
    });

    symbols = discoveredSymbols;
    debug('run:discoveredSymbolsFromPage', '', {
      count: symbols.length,
      firstSymbols: symbols.slice(0, 12).join(' | ')
    });
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function getCells(row) {
    return Array.prototype.slice.call(row.querySelectorAll('th,td')).map(function (cell) {
      return clean(cell.innerText || cell.textContent);
    }).filter(Boolean);
  }

  function keyFor(header, index) {
    return clean(header) || 'column_' + (index + 1);
  }

  function extractTables() {
    return Array.prototype.slice.call(document.querySelectorAll('table')).map(function (table, tableIndex) {
      var tableRows = Array.prototype.slice.call(table.querySelectorAll('tr'));
      var headerCells = Array.prototype.slice.call(table.querySelectorAll('thead tr th')).map(function (header) {
        return clean(header.innerText || header.textContent);
      }).filter(Boolean);

      if (!headerCells.length && tableRows.length) {
        headerCells = getCells(tableRows[0]);
      }

      var bodyRows = tableRows.filter(function (row, rowIndex) {
        if (rowIndex === 0 && headerCells.length) return false;
        return getCells(row).length > 0;
      });

      var rows = bodyRows.map(function (row) {
        var cells = getCells(row);
        var rowObject = { _cells: cells };
        cells.forEach(function (cell, cellIndex) {
          rowObject[keyFor(headerCells[cellIndex], cellIndex)] = cell;
        });
        return rowObject;
      });

      return {
        index: tableIndex,
        headers: headerCells,
        rows: rows
      };
    });
  }

  function clickElement(element) {
    if (window.PointerEvent) {
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
    }
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    element.click();
  }

  function chooseAllScripFilter() {
    debug('chooseAllScripFilter:start');
    var allScripRadio = document.querySelector('#radio-range');
    if (allScripRadio && !allScripRadio.checked) {
      clickElement(allScripRadio);
      allScripRadio.checked = true;
      allScripRadio.dispatchEvent(new Event('input', { bubbles: true }));
      allScripRadio.dispatchEvent(new Event('change', { bubbles: true }));
      var allScripLabel = document.querySelector('label[for="radio-range"]');
      if (allScripLabel) {
        clickElement(allScripLabel);
      }
    }
    debug('chooseAllScripFilter:done', '', {
      found: Boolean(allScripRadio),
      checked: Boolean(allScripRadio && allScripRadio.checked)
    });
  }

  function findNativeScriptInput() {
    var input = document.querySelector('input#script[name="script"], input#script, input[name="script"][list]');
    if (!input || !visible(input)) {
      debug('findNativeScriptInput:notFound', '', {
        found: Boolean(input),
        visible: Boolean(input && visible(input))
      });
      return null;
    }

    var datalistId = input.getAttribute('list') || '';
    var datalist = datalistId ? document.getElementById(datalistId) : null;
    var optionValues = Array.prototype.slice.call(datalist ? datalist.querySelectorAll('option') : []).map(function (option) {
      return option.value || clean(option.innerText || option.textContent);
    }).filter(Boolean);

    debug('findNativeScriptInput:found', '', {
      id: input.id || '',
      name: input.getAttribute('name') || '',
      list: datalistId,
      optionCount: optionValues.length,
      firstOptions: optionValues.slice(0, 8).join(' | ')
    });

    return input;
  }

  function findScripControl() {
    debug('findScripControl:start');
    var nativeSelect = Array.prototype.slice.call(document.querySelectorAll('select')).find(function (select) {
      var label = clean(select.closest('.form-group') ? select.closest('.form-group').innerText : '').toLowerCase();
      return visible(select) && label.indexOf('scrip') >= 0;
    });

    if (nativeSelect) {
      debug('findScripControl:nativeSelect', '', {
        id: nativeSelect.id || '',
        name: nativeSelect.getAttribute('name') || '',
        optionCount: nativeSelect.options ? nativeSelect.options.length : 0
      });
      return nativeSelect;
    }

    var controls = Array.prototype.slice.call(document.querySelectorAll(
      'ng-select, .ng-select, .select2-selection, .select2-container, .ng-select-container, [role="combobox"]'
    ));

    var controlMatch = controls.find(function (control) {
      if (!visible(control)) return false;
      var parentText = clean(control.closest('.form-group') ? control.closest('.form-group').innerText : control.parentElement ? control.parentElement.innerText : '').toLowerCase();
      var ownText = clean(control.innerText || control.textContent || '').toLowerCase();
      return parentText.indexOf('scrip') >= 0 || ownText.indexOf('scrip') >= 0 || control.getAttribute('aria-labelledby');
    }) || controls.find(visible);

    if (controlMatch) {
      debug('findScripControl:container', '', {
        found: true,
        totalControls: controls.length,
        tag: controlMatch.tagName || '',
        classes: String(controlMatch.className || ''),
        text: clean(controlMatch.innerText || controlMatch.textContent || '').slice(0, 80)
      });
      return controlMatch;
    }

    var directInput = Array.prototype.slice.call(document.querySelectorAll('input')).find(function (input) {
      var id = String(input.id || '').toLowerCase();
      var name = String(input.getAttribute('name') || '').toLowerCase();
      var placeholder = String(input.getAttribute('placeholder') || '').toLowerCase();
      var label = clean(input.closest('.form-group') ? input.closest('.form-group').innerText : '').toLowerCase();
      var type = String(input.getAttribute('type') || '').toLowerCase();
      var selectableType = !/radio|checkbox|hidden|submit|button|reset|password/i.test(type);
      return selectableType && visible(input) && (id === 'script' || name === 'script' || placeholder.indexOf('scrip') >= 0 || label.indexOf('scrip') >= 0);
    });

    if (directInput) {
      debug('findScripControl:directInput', '', {
        id: directInput.id || '',
        name: directInput.getAttribute('name') || '',
        type: directInput.getAttribute('type') || ''
      });
      return directInput;
    }

    debug('findScripControl:notFound', '', {
      totalControls: controls.length
    });

    return null;
  }

  function setInputValue(input, value) {
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: value.slice(-1) || 'A' }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: value.slice(-1) || 'A' }));
  }

  async function typeNativeScriptValue(input, symbol) {
    input.scrollIntoView({ block: 'center' });
    clickElement(input);
    input.focus();
    setInputValue(input, '');
    await sleep(120);

    var typed = '';
    for (var index = 0; index < symbol.length; index += 1) {
      var key = symbol[index];
      typed += key;
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: key }));
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, typed);
      if (window.InputEvent) {
        input.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: key,
          inputType: 'insertText'
        }));
      } else {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: key }));
      await sleep(80);
    }

    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    input.focus();

    debug('typeNativeScriptValue:done', symbol, {
      value: input.value || ''
    });
  }

  function visible(element) {
    var rect = element.getBoundingClientRect();
    var style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function findVisibleScripSearchInput() {
    var inputs = Array.prototype.slice.call(document.querySelectorAll(
      '.select2-search__field, input[type="search"], input[role="searchbox"], input'
    ));

    var foundInput = inputs.find(function (input) {
      var type = String(input.getAttribute('type') || '').toLowerCase();
      return visible(input) &&
        !/radio|checkbox|hidden|submit|button|reset/i.test(type) &&
        !/username|password|captcha|pin|otp/i.test([input.id, input.name, input.type].join(' '));
    });

    debug('findVisibleScripSearchInput', '', {
      found: Boolean(foundInput),
      totalInputs: inputs.length,
      classes: foundInput ? String(foundInput.className || '') : '',
      id: foundInput ? String(foundInput.id || '') : '',
      name: foundInput ? String(foundInput.getAttribute('name') || '') : '',
      type: foundInput ? String(foundInput.getAttribute('type') || '') : ''
    });

    return foundInput;
  }

  async function waitForSearchInput() {
    var startedAt = Date.now();
    while (Date.now() - startedAt < 5000) {
      var input = findVisibleScripSearchInput();
      if (input) return input;
      await sleep(150);
    }
    return null;
  }

  function clickMatchingSuggestion(symbol, input) {
    var inputRect = input ? input.getBoundingClientRect() : { y: 0 };
    var candidates = Array.prototype.slice.call(
      document.querySelectorAll('.select2-results__option, .ng-option, .dropdown-item, .dropdown-menu a, .dropdown-menu li, [role="option"], option, li')
    );
    debug('clickMatchingSuggestion:start', symbol, {
      candidateCount: candidates.length
    });

    var match = candidates.find(function (candidate) {
      var text = clean(candidate.innerText || candidate.textContent || candidate.value).toUpperCase();
      var rect = candidate.getBoundingClientRect();
      return visible(candidate) &&
        text.indexOf(symbol.toUpperCase()) >= 0 &&
        rect.y >= inputRect.y - 80 &&
        rect.y <= inputRect.y + 520;
    });

    if (match) {
      debug('clickMatchingSuggestion:matched', symbol, {
        text: clean(match.innerText || match.textContent || match.value).slice(0, 120)
      });
      clickElement(match);
      return true;
    }

    debug('clickMatchingSuggestion:notFound', symbol, {
      visibleCandidates: candidates.filter(visible).slice(0, 8).map(function (candidate) {
        return clean(candidate.innerText || candidate.textContent || candidate.value).slice(0, 80);
      }).join(' | ')
    });

    return false;
  }

  function selectNativeOption(control, symbol) {
    if (!control || String(control.tagName || '').toUpperCase() !== 'SELECT') {
      return false;
    }

    var options = Array.prototype.slice.call(control.options || []);
    var match = options.find(function (option) {
      var text = clean(option.innerText || option.textContent || option.value).toUpperCase();
      return text.indexOf(symbol.toUpperCase()) >= 0;
    });

    if (!match) {
      debug('selectNativeOption:notFound', symbol, {
        optionCount: options.length
      });
      return false;
    }

    control.value = match.value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    debug('selectNativeOption:selected', symbol, {
      text: clean(match.innerText || match.textContent || match.value)
    });
    return true;
  }

  function selectedScripText(control) {
    var roots = [];
    if (control) {
      roots.push(control);
      if (control.closest) {
        var group = control.closest('.form-group');
        if (group) roots.push(group);
      }
      if (control.parentElement) roots.push(control.parentElement);
    }

    for (var index = 0; index < roots.length; index += 1) {
      var root = roots[index];
      var selectedNode = root.querySelector ? root.querySelector('.ng-value-label, .select2-selection__rendered, [title]') : null;
      var selectedText = clean(selectedNode ? selectedNode.innerText || selectedNode.textContent || selectedNode.getAttribute('title') : '');
      if (selectedText) return selectedText;
    }

    return clean(control ? control.innerText || control.textContent || control.value : '');
  }

  async function waitForSelectedSymbol(control, symbol) {
    var startedAt = Date.now();
    while (Date.now() - startedAt < 4500) {
      var selectedText = selectedScripText(control);
      if (selectedText.toUpperCase().indexOf(symbol.toUpperCase()) >= 0) {
        debug('waitForSelectedSymbol:matched', symbol, {
          selectedText: selectedText.slice(0, 160)
        });
        return true;
      }
      await sleep(200);
    }

    debug('waitForSelectedSymbol:notMatched', symbol, {
      selectedText: selectedScripText(control).slice(0, 160)
    });
    return false;
  }

  function findSearchButton() {
    var controls = Array.prototype.slice.call(document.querySelectorAll('button,input[type="submit"],input[type="button"]'));
    return controls.find(function (control) {
      var text = clean(control.innerText || control.textContent || control.value).toLowerCase();
      return visible(control) && text === 'search';
    }) || controls.find(function (control) {
      var text = clean(control.innerText || control.textContent || control.value).toLowerCase();
      return visible(control) && text.indexOf('search') >= 0;
    });
  }

  function hasResultForSymbol(symbol) {
    return extractTables().some(function (table) {
      var headers = table.headers.join(' ').toLowerCase();
      if (headers.indexOf('wacc') < 0 && headers.indexOf('purchase source') < 0) return false;
      return table.rows.some(function (row) {
        return Object.keys(row).some(function (key) {
          return String(row[key]).toUpperCase() === symbol.toUpperCase();
        });
      });
    });
  }

  async function waitForResult(symbol) {
    var startedAt = Date.now();
    while (Date.now() - startedAt < 9000) {
      if (hasResultForSymbol(symbol)) {
        return;
      }
      await sleep(500);
    }
  }

  async function waitForSearchButtonEnabled() {
    var startedAt = Date.now();
    while (Date.now() - startedAt < 5000) {
      var searchButton = findSearchButton();
      if (searchButton && !searchButton.disabled && searchButton.getAttribute('disabled') === null) {
        return searchButton;
      }
      await sleep(200);
    }

    return findSearchButton();
  }

  async function searchSymbolWithNativeInput(symbol) {
    var scriptInput = findNativeScriptInput();
    if (!scriptInput) {
      return false;
    }

    await typeNativeScriptValue(scriptInput, symbol);
    await sleep(650);

    var searchButton = await waitForSearchButtonEnabled();
    debug('searchSymbol:nativeInputSearchButton', symbol, {
      found: Boolean(searchButton),
      disabled: Boolean(searchButton && searchButton.disabled),
      attrDisabled: Boolean(searchButton && searchButton.getAttribute('disabled') !== null),
      inputValue: scriptInput.value || '',
      text: searchButton ? clean(searchButton.innerText || searchButton.textContent || searchButton.value) : ''
    });

    if (!searchButton || searchButton.disabled || searchButton.getAttribute('disabled') !== null) {
      throw new Error('Search button did not enable after typing into #script. Input value: ' + (scriptInput.value || ''));
    }

    debug('searchSymbol:nativeInputClickSearch', symbol);
    clickElement(searchButton);
    await waitForResult(symbol);
    debug('searchSymbol:nativeInputResultReady', symbol, {
      tableCount: extractTables().length
    });
    return true;
  }

  async function searchSymbol(symbol) {
    debug('searchSymbol:start', symbol, {
      pageUrl: window.location.href
    });
    chooseAllScripFilter();
    await sleep(250);

    if (await searchSymbolWithNativeInput(symbol)) {
      return;
    }

    var control = findScripControl();
    if (!control) {
      throw new Error('Could not find the scrip dropdown on this page.');
    }

    if (selectNativeOption(control, symbol)) {
      await sleep(600);
      var nativeSearchButton = await waitForSearchButtonEnabled();
      debug('searchSymbol:nativeSearchButton', symbol, {
        found: Boolean(nativeSearchButton),
        disabled: Boolean(nativeSearchButton && nativeSearchButton.disabled),
        attrDisabled: Boolean(nativeSearchButton && nativeSearchButton.getAttribute('disabled') !== null),
        selectedText: selectedScripText(control).slice(0, 160)
      });
      if (!nativeSearchButton || nativeSearchButton.disabled || nativeSearchButton.getAttribute('disabled') !== null) {
        throw new Error('Search button did not enable after selecting ' + symbol + '. Selected text: ' + selectedScripText(control));
      }

      clickElement(nativeSearchButton);
      await waitForResult(symbol);
      return;
    }

    control.scrollIntoView({ block: 'center' });
    debug('searchSymbol:clickControl', symbol);
    clickElement(control);
    await sleep(350);

    var input = await waitForSearchInput();
    if (!input) {
      throw new Error('Could not find the scrip dropdown search input after opening the dropdown.');
    }

    input.focus();
    debug('searchSymbol:typeSymbol', symbol);
    setInputValue(input, '');
    await sleep(150);
    setInputValue(input, symbol);
    await sleep(900);

    var selectedSuggestion = clickMatchingSuggestion(symbol, input);
    if (!selectedSuggestion) {
      debug('searchSymbol:keyboardFallback', symbol);
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'ArrowDown' }));
      await sleep(250);
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
    }

    await sleep(700);
    var selectedConfirmed = await waitForSelectedSymbol(control, symbol);
    if (!selectedConfirmed) {
      clickElement(control);
      await sleep(250);
      input = await waitForSearchInput();
      if (input) {
        input.focus();
        setInputValue(input, symbol);
        await sleep(700);
        selectedSuggestion = clickMatchingSuggestion(symbol, input);
        await sleep(700);
        selectedConfirmed = await waitForSelectedSymbol(control, symbol);
      }
    }

    var searchButton = await waitForSearchButtonEnabled();
    debug('searchSymbol:searchButton', symbol, {
      found: Boolean(searchButton),
      disabled: Boolean(searchButton && searchButton.disabled),
      attrDisabled: Boolean(searchButton && searchButton.getAttribute('disabled') !== null),
      text: searchButton ? clean(searchButton.innerText || searchButton.textContent || searchButton.value) : '',
      selectedConfirmed: selectedConfirmed,
      selectedText: selectedScripText(control).slice(0, 160)
    });
    if (!searchButton || searchButton.disabled || searchButton.getAttribute('disabled') !== null) {
      throw new Error('Search button did not enable after selecting ' + symbol + '. Selected text: ' + selectedScripText(control));
    }

    debug('searchSymbol:clickSearch', symbol);
    clickElement(searchButton);
    await waitForResult(symbol);
    debug('searchSymbol:resultReady', symbol, {
      tableCount: extractTables().length
    });
  }

  async function run() {
    installNetworkProbe();
    resetNetworkProbeRecords();
    debug('run:start', '', {
      pageUrl: window.location.href,
      totalSymbols: symbols.length
    });
    if (!symbols.length) {
      post({
        type: 'MEROSHARE_AUTOSCAN_ERROR',
        url: window.location.href,
        capturedAt: new Date().toISOString(),
        message: 'No symbols were provided and no #script datalist symbols were found on this page.'
      });
      return;
    }

    if (window.__nepsePortfolioAutoScanRunning) {
      post({
        type: 'MEROSHARE_AUTOSCAN_ERROR',
        url: window.location.href,
        capturedAt: new Date().toISOString(),
        message: 'Auto scan is already running.'
      });
      return;
    }

    window.__nepsePortfolioAutoScanRunning = true;

    try {
      for (var index = 0; index < symbols.length; index += 1) {
        var symbol = symbols[index];
        try {
          resetNetworkProbeRecords();
          await searchSymbol(symbol);
          await sleep(networkProbeEnabled ? 1200 : 500);
          if (networkProbeEnabled) {
            post({
              type: 'MEROSHARE_API_PROBE',
              url: window.location.href,
              capturedAt: new Date().toISOString(),
              symbol: symbol,
              records: getNetworkProbeRecords()
            });
          }
          post({
            type: 'MEROSHARE_AUTOSCAN_ITEM',
            url: window.location.href,
            capturedAt: new Date().toISOString(),
            symbol: symbol,
            index: index + 1,
            total: symbols.length,
            tables: extractTables()
          });
        } catch (error) {
          if (networkProbeEnabled) {
            post({
              type: 'MEROSHARE_API_PROBE',
              url: window.location.href,
              capturedAt: new Date().toISOString(),
              symbol: symbol,
              records: getNetworkProbeRecords()
            });
          }
          post({
            type: 'MEROSHARE_AUTOSCAN_ERROR',
            url: window.location.href,
            capturedAt: new Date().toISOString(),
            symbol: symbol,
            index: index + 1,
            total: symbols.length,
            message: String(error && error.message ? error.message : error)
          });
        }
      }

      post({
        type: 'MEROSHARE_AUTOSCAN_DONE',
        url: window.location.href,
        capturedAt: new Date().toISOString(),
        total: symbols.length
      });
    } finally {
      window.__nepsePortfolioAutoScanRunning = false;
    }
  }

  run().catch(function (error) {
    post({
      type: 'MEROSHARE_AUTOSCAN_ERROR',
      url: window.location.href,
      capturedAt: new Date().toISOString(),
      message: 'Top-level async automation error: ' + String(error && error.message ? error.message : error)
    });
  });
  } catch (error) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'MEROSHARE_AUTOSCAN_ERROR',
        url: window.location.href,
        capturedAt: new Date().toISOString(),
        message: 'Top-level automation error: ' + String(error && error.message ? error.message : error)
      }));
    } catch (postError) {}
  }
})();
true;
`;
}

const currencyFormatter = new Intl.NumberFormat('en-NP', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('en-NP', {
  maximumFractionDigits: 2,
});

function formatMoney(value: number) {
  return `Rs. ${currencyFormatter.format(value)}`;
}

function formatDecimal(value: number) {
  return decimalFormatter.format(value);
}

function stringifyRawData(value: unknown) {
  try {
    return JSON.stringify(sanitizeForLog(value), null, 2);
  } catch {
    return String(value);
  }
}

function tableCellText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(tableCellText).join(', ');
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(sanitizeForLog(value));
  }

  return String(value ?? '-');
}

function tableKeyLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tableColumns(rows: Array<Record<string, unknown>>) {
  const columns = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => columns.add(key));
  });
  return Array.from(columns);
}

function holdingMatchesSearch(holding: Holding, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return holding.symbol.toLowerCase().includes(normalizedQuery) ||
    holding.company.toLowerCase().includes(normalizedQuery);
}

function holdingSortValue(holding: Holding, sortOption: SortOption) {
  const invested = holding.quantity * holding.averageCost;
  const value = holding.quantity * holding.ltp;
  const profitLoss = value - invested;
  const profitLossPct = invested > 0 ? profitLoss / invested : 0;

  switch (sortOption) {
    case 'alphabetical':
      return 0; // tiebreaker in sortHoldings handles a-z
    case 'profit-value':
      return profitLoss;
    case 'profit-pct':
      return profitLossPct;
    case 'loss-value':
      return -profitLoss;
    case 'loss-pct':
      return -profitLossPct;
    case 'invested':
      return invested;
    case 'value':
      return value;
    default:
      return 0;
  }
}

function sortHoldings(holdings: Holding[], sortOption: SortOption) {
  if (sortOption === 'alphabetical') {
    return [...holdings].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }
  return [...holdings].sort((a, b) => {
    const sortDiff = holdingSortValue(b, sortOption) - holdingSortValue(a, sortOption);
    return sortDiff || a.symbol.localeCompare(b.symbol);
  });
}

function accountKey(accountId?: string, symbol?: string) {
  return `${accountId || 'default'}|${symbol || ''}`;
}

function accountIdFromMeroShareAccount(account: {
  dematMasked?: string;
  boid?: string;
  clientCode?: string;
  username?: string;
  name?: string;
}) {
  return account.boid || account.dematMasked || account.clientCode || account.username || 'MeroShare account';
}

function accountFromMeroShareAccount(
  account: {
    dematMasked?: string;
    boid?: string;
    clientCode?: string;
    username?: string;
    name?: string;
  },
  holdingCount: number,
): Account {
  const id = accountIdFromMeroShareAccount(account);
  const ownerName = String(account.name || '').trim();

  return {
    id,
    name: ownerName || (account.username ? `BOID ${account.username}` : 'MeroShare account'),
    dematMasked: account.dematMasked || id,
    boid: account.boid,
    clientCode: account.clientCode,
    username: account.username,
    holdings: holdingCount,
    syncedAt: new Date().toLocaleString(),
  };
}

function recordsForAccount<T extends { accountId?: string }>(records: T[], accountId: string | null) {
  if (!accountId) {
    return records;
  }

  if (accountId === 'default') {
    return records.filter((record) => !record.accountId || record.accountId === 'default');
  }

  return records.filter((record) => record.accountId === accountId);
}

function getPortfolioTotals(holdings: Holding[]) {
  return holdings.reduce(
    (totals, holding) => {
      const cost = holding.quantity * holding.averageCost;
      const value = holding.quantity * holding.ltp;

      return {
        cost: totals.cost + cost,
        value: totals.value + value,
      };
    },
    { cost: 0, value: 0 },
  );
}

function purchaseSourceCoverageForHoldings(
  accountHoldings: Holding[],
  accountCostBasisRecords: CostBasis[],
  accountPurchaseLotRecords: PurchaseLot[],
) {
  const costBasisBySymbol = new Map(accountCostBasisRecords.map((record) => [record.symbol, record]));
  const lotCountBySymbol = accountPurchaseLotRecords.reduce((counts, lot) => {
    counts.set(lot.symbol, (counts.get(lot.symbol) || 0) + 1);
    return counts;
  }, new Map<string, number>());

  return accountHoldings.map((holding) => {
    const record = costBasisBySymbol.get(holding.symbol);
    const raw = asRecord(record?.raw);
    const meroShareRows = asArray(raw.meroShareRows);
    const summary = asRecord(raw.meroShareWaccSummary);
    const rowCount = lotCountBySymbol.get(holding.symbol) || meroShareRows.length;
    const rowQuantity: number = numberFromUnknown(raw.rowQuantity) ||
      meroShareRows.reduce<number>(
        (total, row) => total + numberFromUnknown(asRecord(row).transactionQuantity),
        0,
      );
    const summaryQuantity = numberFromUnknown(summary.totalQuantity);
    const remainingQuantity = Math.max(holding.quantity - rowQuantity, 0);
    const uncoveredQuantity = Math.max(remainingQuantity - summaryQuantity, 0);
    const excessRowQuantity = Math.max(rowQuantity - holding.quantity, 0);
    const hasSummary = numberFromUnknown(summary.averageBuyRate) > 0 ||
      summaryQuantity > 0;

    return {
      symbol: holding.symbol,
      holdingQuantity: holding.quantity,
      rowCount,
      rowQuantity,
      summaryQuantity,
      remainingQuantity,
      uncoveredQuantity,
      excessRowQuantity,
      hasSummary,
      hasNoPurchaseSourceRows: rowCount === 0,
      hasNoPurchaseSourceData: rowCount === 0 && !hasSummary,
      hasQuantityMismatch: uncoveredQuantity > 0.0001 || excessRowQuantity > 0.0001,
    };
  });
}

function safeAnalysisFilePart(value: string) {
  return (value || 'account')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

function maskAccountIdentifier(value?: string) {
  const text = String(value || '').trim();
  if (text.length <= 8) {
    return text;
  }

  return `${text.slice(0, 4)}********${text.slice(-4)}`;
}

function analysisSafeAccount(account: Account) {
  return {
    ...account,
    id: maskAccountIdentifier(account.id),
    boid: maskAccountIdentifier(account.boid),
    clientCode: maskAccountIdentifier(account.clientCode),
    username: maskAccountIdentifier(account.username),
  };
}

function analysisSafeRecord<T extends { accountId?: string }>(record: T) {
  return {
    ...record,
    accountId: maskAccountIdentifier(record.accountId),
  };
}

function accountAnalysisExport(
  account: Account,
  allHoldings: Holding[],
  allCostBasisRecords: CostBasis[],
  allPurchaseLotRecords: PurchaseLot[],
  exportedAt: string,
) {
  const accountHoldings = recordsForAccount(allHoldings, account.id);
  const accountCostBasisRecords = recordsForAccount(allCostBasisRecords, account.id);
  const accountPurchaseLotRecords = recordsForAccount(allPurchaseLotRecords, account.id);
  const totals = getPortfolioTotals(accountHoldings);
  const coverage = purchaseSourceCoverageForHoldings(
    accountHoldings,
    accountCostBasisRecords,
    accountPurchaseLotRecords,
  );

  return {
    schemaVersion: 1,
    exportedAt,
    account: analysisSafeAccount(account),
    totals: {
      cost: totals.cost,
      value: totals.value,
      profitLoss: totals.value - totals.cost,
      profitLossPercent: totals.cost > 0 ? ((totals.value - totals.cost) / totals.cost) * 100 : 0,
    },
    holdings: accountHoldings.map((holding) => ({
      ...analysisSafeRecord(holding),
      marketValue: holding.quantity * holding.ltp,
      costValue: holding.quantity * holding.averageCost,
      profitLoss: (holding.quantity * holding.ltp) - (holding.quantity * holding.averageCost),
    })),
    costBasisRecords: accountCostBasisRecords.map(analysisSafeRecord),
    purchaseLotRecords: accountPurchaseLotRecords.map(analysisSafeRecord),
    purchaseSourceCoverage: coverage,
    warnings: {
      noPurchaseSourceRows: coverage.filter((item) => item.hasNoPurchaseSourceRows).map((item) => item.symbol),
      noPurchaseSourceData: coverage.filter((item) => item.hasNoPurchaseSourceData).map((item) => item.symbol),
      quantityMismatch: coverage.filter((item) => item.hasQuantityMismatch),
    },
  };
}

function logAnalysisExportJson(fileName: string, json: string) {
  const chunkSize = 3000;
  console.log(`[Portfolio Analysis Export] BEGIN ${fileName}`);
  for (let index = 0; index < json.length; index += chunkSize) {
    console.log(`[Portfolio Analysis Export] ${fileName} ${index / chunkSize + 1}: ${json.slice(index, index + chunkSize)}`);
  }
  console.log(`[Portfolio Analysis Export] END ${fileName}`);
}

async function writeAccountAnalysisExports(
  accounts: Account[],
  allHoldings: Holding[],
  allCostBasisRecords: CostBasis[],
  allPurchaseLotRecords: PurchaseLot[],
) {
  if (!ANALYSIS_EXPORT_DIR_URI || !accounts.length) {
    return [];
  }

  await FileSystem.makeDirectoryAsync(ANALYSIS_EXPORT_DIR_URI, { intermediates: true });
  const exportedAt = new Date().toISOString();

  return Promise.all(accounts.map(async (account) => {
    const exportData = accountAnalysisExport(
      account,
      allHoldings,
      allCostBasisRecords,
      allPurchaseLotRecords,
      exportedAt,
    );
    const fileName = `${safeAnalysisFilePart(account.name)}-${safeAnalysisFilePart(account.dematMasked || account.id)}.json`;
    const uri = `${ANALYSIS_EXPORT_DIR_URI}${fileName}`;
    const json = JSON.stringify(exportData, null, 2);

    await FileSystem.writeAsStringAsync(uri, json);
    logAnalysisExportJson(fileName, json);

    return {
      accountId: account.id,
      accountName: account.name,
      dematMasked: account.dematMasked,
      fileName,
      uri,
      holdingCount: exportData.holdings.length,
      purchaseLotCount: exportData.purchaseLotRecords.length,
      costBasisCount: exportData.costBasisRecords.length,
      warningCount: exportData.warnings.quantityMismatch.length,
    };
  }));
}

function parseNepaliNumber(value?: string) {
  if (!value) return 0;
  const numeric = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return numeric ? Number(numeric[0]) : 0;
}

function normalizeHolding(candidate: ExtractedHoldingCandidate): Holding | null {
  const symbol = candidate.symbol?.trim().toUpperCase() || '';
  const quantity = parseNepaliNumber(candidate.quantity);

  if (!symbol || quantity <= 0) {
    return null;
  }

  const averageCost = parseNepaliNumber(candidate.averageCost);
  const ltp = parseNepaliNumber(candidate.ltp);

  return {
    symbol,
    company: candidate.company?.trim() || symbol,
    quantity,
    averageCost,
    ltp: ltp || averageCost,
    source: 'MeroShare report',
    raw: candidate.raw,
  };
}

function cleanCell(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeHeader(value: string, index: number) {
  return cleanCell(value) || `column_${index + 1}`;
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = '';
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && isQuoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (char === delimiter && !isQuoted) {
      cells.push(cleanCell(current));
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(cleanCell(current));
  return cells;
}

function parseDelimitedRows(rawText: string) {
  const lines = rawText
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiterScores = [',', '\t', ';'].map((delimiter) => ({
    delimiter,
    score: lines.slice(0, 5).reduce((total, line) => total + parseDelimitedLine(line, delimiter).length, 0),
  }));
  const delimiter = delimiterScores.sort((a, b) => b.score - a.score)[0].delimiter;
  const headers = parseDelimitedLine(lines[0], delimiter).map(safeHeader);

  return lines.slice(1).map((line) => {
    const cells = parseDelimitedLine(line, delimiter);
    const row: Record<string, string | string[]> = { _cells: cells };

    cells.forEach((cell, index) => {
      row[headers[index] || `column_${index + 1}`] = cell;
    });

    return row;
  });
}

function parseHtmlRows(rawText: string) {
  const rowMatches = rawText.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  if (rowMatches.length < 2) {
    return [];
  }

  const tableRows = rowMatches
    .map((row) => {
      const cellMatches = row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
      return cellMatches.map(cleanCell).filter(Boolean);
    })
    .filter((cells) => cells.length > 0);

  if (tableRows.length < 2) {
    return [];
  }

  const headers = tableRows[0].map(safeHeader);

  return tableRows.slice(1).map((cells) => {
    const row: Record<string, string | string[]> = { _cells: cells };

    cells.forEach((cell, index) => {
      row[headers[index] || `column_${index + 1}`] = cell;
    });

    return row;
  });
}

function pickFromRow(row: Record<string, string | string[]>, labels: string[]) {
  const keys = Object.keys(row);

  for (const label of labels) {
    const key = keys.find((item) => item.toLowerCase().includes(label.toLowerCase()));
    const value = key ? row[key] : '';

    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return '';
}

function pickExactFromRow(row: Record<string, string | string[]>, labels: string[]) {
  const keys = Object.keys(row);

  for (const label of labels) {
    const normalizedLabel = label.toLowerCase();
    const key = keys.find((item) => item.toLowerCase() === normalizedLabel);
    const value = key ? row[key] : '';

    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return '';
}

function inferSymbolFromRow(row: Record<string, string | string[]>) {
  const labeledValue = pickFromRow(row, ['symbol', 'scrip', 'script', 'security', 'company', 'isin']);
  const labeledMatch = labeledValue.match(/[A-Z][A-Z0-9.]{1,12}/);

  if (labeledMatch) {
    return labeledMatch[0];
  }

  const cells = Array.isArray(row._cells) ? row._cells : [];
  const directCell = cells.find((cell) => /^[A-Z][A-Z0-9.]{1,12}$/.test(String(cell).trim()));

  return directCell ? String(directCell).trim() : '';
}

function rowToHoldingCandidate(row: Record<string, string | string[]>): ExtractedHoldingCandidate {
  const averageCost =
    pickExactFromRow(row, ['WACC Rate', 'Average Cost', 'Avg Cost', 'Weighted Average Cost']) ||
    pickFromRow(row, ['average cost', 'avg cost', 'weighted average', 'cost price']);

  return {
    symbol: inferSymbolFromRow(row),
    company: pickFromRow(row, ['company', 'scrip', 'script', 'security']),
    quantity: pickFromRow(row, [
      'current balance',
      'free balance',
      'total balance',
      'balance',
      'quantity',
      'qty',
      'unit',
    ]),
    averageCost,
    ltp: pickFromRow(row, ['ltp', 'last traded', 'market price', 'closing price', 'price']),
    raw: row,
  };
}

function rowToCostBasis(row: Record<string, string | string[]>): CostBasis | null {
  const symbol = inferSymbolFromRow(row).trim().toUpperCase();
  const averageCost = parseNepaliNumber(
    pickExactFromRow(row, ['WACC Rate', 'Average Cost', 'Avg Cost', 'Weighted Average Cost']),
  );
  const calculatedQuantity = parseNepaliNumber(
    pickExactFromRow(row, ['WACC Calculated Quantity', 'Calculated Quantity', 'Quantity']),
  );
  const totalCost = parseNepaliNumber(
    pickExactFromRow(row, ['Total Cost Of Capital', 'Total Cost', 'Cost Of Capital']),
  );

  if (!symbol || averageCost <= 0) {
    return null;
  }

  return {
    symbol,
    calculatedQuantity,
    averageCost,
    totalCost,
    raw: row,
  };
}

function rowToPurchaseLot(row: Record<string, string | string[]>): PurchaseLot | null {
  const symbol = inferSymbolFromRow(row).trim().toUpperCase();
  const transactionDate = pickExactFromRow(row, ['Transaction Date', 'Date']);
  const purchaseSource = pickExactFromRow(row, ['Purchase Source', 'Source']);
  const quantity = parseNepaliNumber(
    pickExactFromRow(row, ['Transaction Quantity', 'Quantity', 'Qty']),
  );

  if (!symbol || (!transactionDate && !purchaseSource) || quantity <= 0) {
    return null;
  }

  return {
    symbol,
    transactionDate,
    quantity,
    rate: parseNepaliNumber(pickExactFromRow(row, ['Rate'])),
    purchaseSource,
    purchasePrice: parseNepaliNumber(pickExactFromRow(row, ['Purchase Price', 'Price'])),
    totalCost: parseNepaliNumber(pickExactFromRow(row, ['Total Cost'])),
    remarks: pickExactFromRow(row, ['Remarks']),
    raw: row,
  };
}

function extractCostBasisFromRows(rows: Array<Record<string, string | string[]>>) {
  return rows
    .map(rowToCostBasis)
    .filter((costBasis): costBasis is CostBasis => Boolean(costBasis));
}

function extractPurchaseLotsFromRows(rows: Array<Record<string, string | string[]>>) {
  return rows
    .map(rowToPurchaseLot)
    .filter((lot): lot is PurchaseLot => Boolean(lot));
}

function extractCostBasisFromTables(tables: ExtractedTable[]) {
  return extractCostBasisFromRows(tables.flatMap((table) => table.rows));
}

function extractPurchaseLotsFromTables(tables: ExtractedTable[]) {
  return extractPurchaseLotsFromRows(tables.flatMap((table) => table.rows));
}

function mergeCostBasisRecords(existing: CostBasis[], incoming: CostBasis[]) {
  const bySymbol = new Map(existing.map((record) => [accountKey(record.accountId, record.symbol), record]));

  incoming.forEach((record) => {
    bySymbol.set(accountKey(record.accountId, record.symbol), record);
  });

  return Array.from(bySymbol.values()).sort((a, b) => {
    const accountCompare = (a.accountId || '').localeCompare(b.accountId || '');
    if (accountCompare !== 0) return accountCompare;
    return a.symbol.localeCompare(b.symbol);
  });
}

function purchaseLotKey(lot: PurchaseLot) {
  return [
    lot.accountId || 'default',
    lot.symbol,
    lot.transactionDate,
    lot.quantity,
    lot.rate,
    lot.purchaseSource,
    lot.purchasePrice,
    lot.totalCost,
  ].join('|');
}

function mergePurchaseLotRecords(existing: PurchaseLot[], incoming: PurchaseLot[]) {
  const byKey = new Map(existing.map((lot) => [purchaseLotKey(lot), lot]));

  incoming.forEach((lot) => {
    byKey.set(purchaseLotKey(lot), lot);
  });

  return Array.from(byKey.values()).sort((a, b) => {
    const accountCompare = (a.accountId || '').localeCompare(b.accountId || '');
    if (accountCompare !== 0) return accountCompare;
    const symbolCompare = a.symbol.localeCompare(b.symbol);
    if (symbolCompare !== 0) return symbolCompare;
    return b.transactionDate.localeCompare(a.transactionDate);
  });
}

function mergeCostBasisIntoHoldings(holdings: Holding[], costBasisRecords: CostBasis[]) {
  const bySymbol = new Map(costBasisRecords.map((record) => [accountKey(record.accountId, record.symbol), record]));

  return holdings.map((holding) => {
    const storedCostBasis = bySymbol.get(accountKey(holding.accountId, holding.symbol));

    if (!storedCostBasis) {
      return holding;
    }

    const costBasis = mixedCostBasisForHolding(storedCostBasis, holding.quantity);

    return {
      ...holding,
      averageCost: costBasis.averageCost,
      source: holding.source.includes('WACC')
        ? holding.source
        : `${holding.source} + MeroShare WACC`,
      raw: {
        holding: holding.raw || {},
        costBasis: costBasis.raw || {},
      },
    };
  });
}

function isLegacyAccountId(accountId?: string) {
  return !accountId || accountId === 'default';
}

function consolidateHoldings(holdings: Holding[]) {
  const bySymbol = new Map<string, Holding & { accountCount?: number }>();
  const accountIdsBySymbol = new Map<string, Set<string>>();

  holdings.forEach((holding) => {
    const existing = bySymbol.get(holding.symbol);
    const accountIds = accountIdsBySymbol.get(holding.symbol) || new Set<string>();
    accountIds.add(holding.accountId || 'default');
    accountIdsBySymbol.set(holding.symbol, accountIds);

    if (!existing) {
      bySymbol.set(holding.symbol, {
        ...holding,
        accountId: 'consolidated',
        raw: {
          holdings: [holding.raw || {}],
        },
      });
      return;
    }

    const existingCost = existing.quantity * existing.averageCost;
    const incomingCost = holding.quantity * holding.averageCost;
    const quantity = existing.quantity + holding.quantity;

    bySymbol.set(holding.symbol, {
      ...existing,
      quantity,
      averageCost: quantity > 0 ? (existingCost + incomingCost) / quantity : 0,
      ltp: holding.ltp || existing.ltp,
      source: accountIds.size > 1 ? `Consolidated across ${accountIds.size} demat accounts` : existing.source,
      raw: {
        holdings: [
          ...asArray(asRecord(existing.raw).holdings),
          holding.raw || {},
        ],
      },
    });
  });

  return Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function tablesContainPortfolioHoldings(tables: ExtractedTable[]) {
  return tables.some((table) => {
    const headers = table.headers.join(' ').toLowerCase();
    return headers.includes('current balance') && headers.includes('ltp');
  });
}

function rowsContainPortfolioHoldings(rows: Array<Record<string, string | string[]>>) {
  return rows.some((row) => {
    const headers = Object.keys(row).join(' ').toLowerCase();
    return headers.includes('current balance') && headers.includes('ltp');
  });
}

function parseReportRows(rawText: string) {
  const trimmed = rawText.trim();

  if (!trimmed) {
    return [];
  }

  if (/<table|<tr|<td|<th/i.test(trimmed)) {
    const htmlRows = parseHtmlRows(trimmed);
    if (htmlRows.length) {
      return htmlRows;
    }
  }

  return parseDelimitedRows(trimmed);
}

function fileNameFromUrl(downloadUrl: string) {
  const fallback = `meroshare-report-${Date.now()}.txt`;

  try {
    const parsed = new URL(downloadUrl);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    return decodeURIComponent(lastSegment || fallback).replace(/[^a-zA-Z0-9._-]/g, '_');
  } catch {
    return fallback;
  }
}

function safeFileName(fileName: string) {
  const fallback = `meroshare-report-${Date.now()}.csv`;
  return (fileName || fallback).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function looksLikeBinary(rawText: string) {
  return rawText.startsWith('PK') || rawText.startsWith('%PDF') || rawText.includes('\u0000');
}

async function parseReportText(fileName: string, rawText: string): Promise<ParsedReport> {
  if (looksLikeBinary(rawText)) {
    throw new Error(
      'Downloaded report appears to be binary, likely PDF/XLSX. CSV text is readable now; binary report parsing is next.',
    );
  }

  const savedFileName = safeFileName(fileName);
  const localUri = `${FileSystem.documentDirectory}${savedFileName}`;
  await FileSystem.writeAsStringAsync(localUri, rawText);

  const rows = parseReportRows(rawText);
  const holdings = rows
    .map(rowToHoldingCandidate)
    .map(normalizeHolding)
    .filter((holding): holding is Holding => Boolean(holding));
  const costBasis = extractCostBasisFromRows(rows);
  const purchaseLots = extractPurchaseLotsFromRows(rows);

  return {
    fileName: savedFileName,
    localUri,
    rawText,
    rows,
    holdings,
    costBasis,
    purchaseLots,
  };
}

async function downloadAndParseReport(downloadUrl: string): Promise<ParsedReport> {
  const fileName = fileNameFromUrl(downloadUrl);
  const localUri = `${FileSystem.documentDirectory}${fileName}`;

  console.log(`[MeroShare Sync] Download started: ${downloadUrl}`);
  const download = await FileSystem.downloadAsync(downloadUrl, localUri, {
    headers: {
      Referer: MEROSHARE_URL,
    },
  });

  const rawText = await FileSystem.readAsStringAsync(download.uri);

  const parsedReport = await parseReportText(fileName, rawText);

  return {
    ...parsedReport,
    localUri: download.uri,
  };
}

function logLarge(label: string, payload: unknown) {
  const fullText = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  const text = fullText.length > MAX_MEROSHARE_LOG_CHARS
    ? `${fullText.slice(0, MAX_MEROSHARE_LOG_CHARS)}\n...truncated ${fullText.length - MAX_MEROSHARE_LOG_CHARS} characters...`
    : fullText;
  const chunkSize = 3000;

  console.log(`[MeroShare Sync] ${label}`);
  for (let index = 0; index < text.length; index += chunkSize) {
    console.log(text.slice(index, index + chunkSize));
  }
}

function csvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildHoldingsCSV(
  holdings: Holding[],
  purchaseLots: PurchaseLot[],
  costBasisRecords: CostBasis[],
  accountList: Account[],
  includeAccount: boolean,
): string {
  const accountNameById = new Map(accountList.map((a) => [a.id, a.name]));
  const headers = [
    ...(includeAccount ? ['Account'] : []),
    'Symbol',
    'Company',
    'Qty Held',
    'LTP (Rs.)',
    'Invested (Rs.)',
    'Current Value (Rs.)',
    'P&L (Rs.)',
    'P&L (%)',
    'Row Type',
    'Source',
    'Date',
    'Qty',
    'Rate (Rs.)',
    'Total Cost (Rs.)',
  ];
  const lines: string[] = [headers.join(',')];

  for (const holding of holdings) {
    const invested = holding.quantity * holding.averageCost;
    const value = holding.quantity * holding.ltp;
    const pnl = value - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    const accountName = holding.accountId
      ? (accountNameById.get(holding.accountId) || holding.accountId)
      : '';

    const holdingContext = [
      ...(includeAccount ? [csvCell(accountName)] : []),
      csvCell(holding.symbol),
      csvCell(holding.company),
      holding.quantity.toFixed(2),
      holding.ltp.toFixed(2),
      invested.toFixed(2),
      value.toFixed(2),
      pnl.toFixed(2),
      pnlPct.toFixed(2) + '%',
    ];

    const lots = purchaseLots.filter(
      (lot) => lot.symbol === holding.symbol && lot.accountId === holding.accountId,
    );

    const costBasis = costBasisRecords.find(
      (r) => r.symbol === holding.symbol && r.accountId === holding.accountId,
    );
    const waccSummary = costBasis?.raw
      ? (costBasis.raw as Record<string, unknown>).meroShareWaccSummary as Record<string, unknown> | undefined
      : undefined;
    const waccAvgRate = waccSummary ? numberFromUnknown(waccSummary.averageBuyRate) : 0;
    const waccQty = waccSummary ? numberFromUnknown(waccSummary.totalQuantity) : 0;
    const waccTotalCost = waccSummary ? numberFromUnknown(waccSummary.totalCost) : 0;
    const hasWacc = waccAvgRate > 0 || waccQty > 0;

    for (const lot of lots) {
      lines.push([
        ...holdingContext,
        'PURCHASE_LOT',
        csvCell(lot.purchaseSource),
        csvCell(lot.transactionDate),
        lot.quantity.toFixed(2),
        lot.rate.toFixed(2),
        lot.totalCost.toFixed(2),
      ].join(','));
    }

    if (hasWacc) {
      lines.push([
        ...holdingContext,
        'WACC_SUMMARY',
        '',
        '',
        waccQty > 0 ? waccQty.toFixed(2) : '',
        waccAvgRate > 0 ? waccAvgRate.toFixed(2) : '',
        waccTotalCost > 0 ? waccTotalCost.toFixed(2) : '',
      ].join(','));
    }

    if (lots.length === 0 && !hasWacc) {
      lines.push([...holdingContext, 'NO_DATA', '', '', '', '', ''].join(','));
    }
  }

  return lines.join('\n');
}

async function shareHoldingsCSV(filename: string, csv: string): Promise<void> {
  const uri = `${FileSystem.cacheDirectory || ''}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv);
  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Share portfolio data',
  });
}

function buildPLSummaryCSV(
  holdings: Holding[],
  accountList: Account[],
  includeAccount: boolean,
): string {
  const accountNameById = new Map(accountList.map((a) => [a.id, a.name]));
  const headers = [
    ...(includeAccount ? ['Account'] : []),
    'Symbol',
    'Company',
    'Qty',
    'Avg Cost (Rs.)',
    'LTP (Rs.)',
    'Invested (Rs.)',
    'Current Value (Rs.)',
    'P&L (Rs.)',
    'P&L (%)',
  ];
  const lines: string[] = [headers.join(',')];

  for (const holding of holdings) {
    const invested = holding.quantity * holding.averageCost;
    const value = holding.quantity * holding.ltp;
    const pnl = value - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    const accountName = holding.accountId
      ? (accountNameById.get(holding.accountId) || holding.accountId)
      : '';

    lines.push([
      ...(includeAccount ? [csvCell(accountName)] : []),
      csvCell(holding.symbol),
      csvCell(holding.company),
      holding.quantity.toFixed(2),
      holding.averageCost.toFixed(2),
      holding.ltp.toFixed(2),
      invested.toFixed(2),
      value.toFixed(2),
      pnl.toFixed(2),
      pnlPct.toFixed(2) + '%',
    ].join(','));
  }

  return lines.join('\n');
}

function isLoginUrl(url: string) {
  return url.includes('/login');
}

function isLoggedInMeroShareUrl(url: string) {
  if (!url.includes('meroshare.cdsc.com.np') || isLoginUrl(url)) {
    return false;
  }

  return /#\/(dashboard|purchase|portfolio|my-asba|bank|share|transaction|pledge|edis|details)/i.test(url);
}

function endpointFromRequestUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname || parsed.href;
  } catch {
    return url.replace(/^https?:\/\/[^/]+/i, '').split('?')[0] || url;
  }
}

function summarizeNetworkRecords(records: MeroShareNetworkLogPayload[]) {
  const responseRecords = records.filter((record) => record.direction === 'response');
  const endpoints = Array.from(
    new Set(
      records
        .map((record) => endpointFromRequestUrl(record.requestUrl))
        .filter(Boolean),
    ),
  ).slice(0, 6);

  return {
    recordCount: records.length,
    responseCount: responseRecords.length,
    endpoints,
  };
}

function maskSensitiveValue(key: string, value: unknown): unknown {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey.includes('authorization') || normalizedKey.includes('token')) {
    return '[redacted]';
  }

  if (normalizedKey === 'demat') {
    const text = String(value || '');
    return text.length > 4 ? `${text.slice(0, 4)}********${text.slice(-4)}` : text;
  }

  return value;
}

function sanitizeForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, childValue]) => [
      key,
      sanitizeForLog(maskSensitiveValue(key, childValue)),
    ]),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberFromUnknown(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }

  return parseNepaliNumber(String(value || ''));
}

function normalizedMarketKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function marketValueForAliases(record: Record<string, unknown>, aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizedMarketKey));
  const entry = Object.entries(record).find(([key]) => aliasSet.has(normalizedMarketKey(key)));
  return entry ? entry[1] : undefined;
}

function marketRecordToQuote(record: Record<string, unknown>, fallbackSymbol = ''): PriceQuote | null {
  const symbol = String(
    marketValueForAliases(record, [
      'symbol',
      'scrip',
      'scripSymbol',
      'stockSymbol',
      'securitySymbol',
      'companySymbol',
    ]) || fallbackSymbol,
  ).trim().toUpperCase();
  const ltp = numberFromUnknown(
    marketValueForAliases(record, [
      'ltp',
      'lastUpdatedPrice',
      'lastTradedPrice',
      'lastTradePrice',
      'lastTransactionPrice',
      'lastPrice',
      'closingPrice',
      'closePrice',
      'averageTradedPrice',
      'previousClose',
      'previousClosingPrice',
    ]),
  );

  if (!symbol || ltp <= 0) {
    return null;
  }

  const previousClose = numberFromUnknown(
    marketValueForAliases(record, ['previousDayClosePrice', 'previousClose', 'previousClosingPrice']),
  );
  const dayChangePercent = previousClose > 0 ? ((ltp - previousClose) / previousClose) * 100 : undefined;

  return {
    symbol,
    ltp,
    dayChangePercent,
    raw: sanitizeForLog(record),
  };
}

function collectMarketQuotes(value: unknown, fallbackSymbol = '', depth = 0): PriceQuote[] {
  if (depth > 8) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMarketQuotes(item, fallbackSymbol, depth + 1));
  }

  const record = asRecord(value);
  if (!Object.keys(record).length) {
    return [];
  }

  const directQuote = marketRecordToQuote(record, fallbackSymbol);
  if (directQuote) {
    return [directQuote];
  }

  return Object.entries(record).flatMap(([key, childValue]) => {
    const childRecord = asRecord(childValue);
    const childFallbackSymbol = childRecord.symbol ? fallbackSymbol : key;
    return collectMarketQuotes(childValue, childFallbackSymbol, depth + 1);
  });
}

function mergeLatestPricesIntoHoldings(holdings: Holding[], prices: Map<string, PriceQuote>, updatedAt: string) {
  return holdings.map((holding) => {
    const quote = prices.get(holding.symbol);
    if (!quote || quote.ltp <= 0) {
      return holding;
    }
    if (quote.ltp === holding.ltp) {
      return quote.dayChangePercent !== undefined
        ? { ...holding, dayChangePercent: quote.dayChangePercent }
        : holding;
    }

    const rawRecord = asRecord(holding.raw);
    return {
      ...holding,
      ltp: quote.ltp,
      dayChangePercent: quote.dayChangePercent,
      source: holding.source.includes('NEPSE latest price')
        ? holding.source
        : `${holding.source} + NEPSE latest price`,
      raw: {
        ...rawRecord,
        latestPrice: {
          ltp: quote.ltp,
          source: 'NEPSE latest price provider',
          updatedAt,
          raw: quote.raw || {},
        },
      },
    };
  });
}

async function fetchWithTimeout(url: string, timeoutMs: number, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function postJsonWithTimeout(url: string, body: unknown, headers: Record<string, string>, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      body: JSON.stringify(body),
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        ...headers,
      },
      method: 'POST',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function nepseDigitParts(value: unknown) {
  const numberValue = Math.trunc(Math.abs(Number(value) || 0));
  const hundreds = Math.trunc(numberValue / 100) % 10;
  const tens = Math.trunc(numberValue / 10) % 10;
  const ones = numberValue % 10;

  return {
    hundreds,
    tens,
    sum: hundreds + tens + ones,
  };
}

function nepseTokenStripIndexes(salt: unknown) {
  const digits = nepseDigitParts(salt);
  const tableValue = NEPSE_TOKEN_STRIP_TABLE[digits.sum] || 0;

  return [
    tableValue + 22,
    digits.hundreds + digits.tens + tableValue + 32,
    digits.hundreds + digits.tens + tableValue + 60,
    digits.tens + tableValue + 88,
    digits.hundreds + tableValue + 110,
  ];
}

function stripNepseWebsiteToken(token: string, salt: unknown) {
  const indexes = nepseTokenStripIndexes(salt).sort((a, b) => a - b);
  return indexes.reduceRight((cleanedToken, index) => (
    index >= 0 && index < cleanedToken.length
      ? `${cleanedToken.slice(0, index)}${cleanedToken.slice(index + 1)}`
      : cleanedToken
  ), token);
}

function nepseRequestId(proof: Record<string, unknown>, marketStatus: Record<string, unknown>) {
  const day = new Date().getDate();
  const marketId = Math.trunc(numberFromUnknown(marketStatus.id));
  const dummySeed = (NEPSE_DUMMY_DATA[marketId] || 0) + marketId + (2 * day);
  const accessTokens = [
    numberFromUnknown(proof.salt1),
    numberFromUnknown(proof.salt2),
    numberFromUnknown(proof.salt3),
    numberFromUnknown(proof.salt4),
    numberFromUnknown(proof.salt5),
  ];
  const tokenIndex = dummySeed % 10 < 5 ? 1 : 3;

  return dummySeed + (accessTokens[tokenIndex] * day) - accessTokens[tokenIndex - 1];
}

function parseNepseIndex(payload: unknown): NepseIndexData | null {
  if (!Array.isArray(payload) || !payload.length) {
    return null;
  }

  // Find the NEPSE composite index entry (e.g. "NEPSE Index")
  const entry = payload.find((item) =>
    String(asRecord(item).index || '').toUpperCase().includes('NEPSE'),
  ) ?? payload[0];

  const r = asRecord(entry);
  const currentValue = numberFromUnknown(r.currentValue);
  const pointChange = numberFromUnknown(r.change);
  const percentChange = numberFromUnknown(r.perChange);

  if (!currentValue) {
    return null;
  }

  return { currentValue, pointChange, percentChange };
}

function businessDateFromMarketStatus(marketStatus: Record<string, unknown>) {
  const asOf = String(marketStatus.asOf || '').split('T')[0];
  if (asOf) {
    return asOf;
  }

  return new Date().toISOString().split('T')[0];
}

// Generates a self-contained JS script to run inside a WebView loaded at https://www.nepalstock.com/
// Uses same-origin relative URLs so the WAF TLS-fingerprint check is bypassed (WebView = real Chrome).
function createNepseFetchScript(symbols: string[]): string {
  const symbolsJson = JSON.stringify(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean));
  const stripTableJson = JSON.stringify(NEPSE_TOKEN_STRIP_TABLE);
  const dummyDataJson = JSON.stringify(NEPSE_DUMMY_DATA);

  return `
(async function() {
  var STRIP_TABLE = ${stripTableJson};
  var DUMMY_DATA = ${dummyDataJson};
  var symbols = ${symbolsJson};

  function digitParts(value) {
    var n = Math.trunc(Math.abs(Number(value) || 0));
    var hundreds = Math.trunc(n / 100) % 10;
    var tens = Math.trunc(n / 10) % 10;
    var ones = n % 10;
    return { hundreds: hundreds, tens: tens, sum: hundreds + tens + ones };
  }

  function stripToken(token, salt) {
    var d = digitParts(salt);
    var tv = STRIP_TABLE[d.sum] || 0;
    var idxs = [tv+22, d.hundreds+d.tens+tv+32, d.hundreds+d.tens+tv+60, d.tens+tv+88, d.hundreds+tv+110];
    idxs.sort(function(a,b){return a-b;});
    return idxs.reduceRight(function(t,i){
      return (i>=0 && i<t.length) ? t.slice(0,i)+t.slice(i+1) : t;
    }, String(token||''));
  }

  function calcRequestId(proof, market) {
    var day = new Date().getDate();
    var marketId = Math.trunc(Number(market.id)||0);
    var seed = (DUMMY_DATA[marketId]||0) + marketId + (2*day);
    var salts = [Number(proof.salt1)||0, Number(proof.salt2)||0, Number(proof.salt3)||0, Number(proof.salt4)||0, Number(proof.salt5)||0];
    var ti = seed%10 < 5 ? 1 : 3;
    return seed + (salts[ti]*day) - salts[ti-1];
  }

  function bizDate(market) {
    var d = String(market.asOf||'').split('T')[0];
    return d || new Date().toISOString().split('T')[0];
  }

  var SYMBOL_KEYS = ['symbol','scrip','scripSymbol','stockSymbol','securitySymbol','companySymbol'];
  var PRICE_KEYS = ['ltp','lastUpdatedPrice','lastTradedPrice','lastTradePrice','lastTransactionPrice','lastPrice','closingPrice','closePrice','averageTradedPrice','previousClose','previousClosingPrice'];
  var PREV_CLOSE_KEYS = ['previousDayClosePrice','previousClose','previousClosingPrice'];

  function extractQuotes(payload, wanted, out, depth) {
    if (depth>8) return;
    if (Array.isArray(payload)) { payload.forEach(function(x){extractQuotes(x,wanted,out,depth+1);}); return; }
    if (!payload||typeof payload!=='object') return;
    var keys=Object.keys(payload); if(!keys.length) return;
    var sym=''; for(var i=0;i<SYMBOL_KEYS.length;i++){if(payload[SYMBOL_KEYS[i]]){sym=String(payload[SYMBOL_KEYS[i]]).trim().toUpperCase();break;}}
    var price=0; for(var j=0;j<PRICE_KEYS.length;j++){var v=Number(payload[PRICE_KEYS[j]]);if(v>0){price=v;break;}}
    if(sym&&price>0&&wanted.indexOf(sym)>=0){
      if(!out[sym]){
        var prevClose=0; for(var k=0;k<PREV_CLOSE_KEYS.length;k++){var pv=Number(payload[PREV_CLOSE_KEYS[k]]);if(pv>0){prevClose=pv;break;}}
        var chg = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : null;
        out[sym]={ltp:price,dayChangePercent:chg};
      }
      return;
    }
    keys.forEach(function(k){extractQuotes(payload[k],wanted,out,depth+1);});
  }

  try {
    var hdrs = {'accept':'application/json, text/plain, */*'};
    var pr = await fetch('/api/authenticate/prove',{headers:hdrs});
    if(!pr.ok) throw new Error('/prove HTTP '+pr.status);
    var proof = await pr.json();
    var token = proof.accessToken ? stripToken(proof.accessToken, proof.salt2) : '';
    if(!token) throw new Error('/prove: no accessToken');

    var ah = Object.assign({},hdrs,{'Authorization':'Salter '+token});

    var mr = await fetch('/api/nots/nepse-data/market-open',{headers:ah});
    if(!mr.ok) throw new Error('/market-open HTTP '+mr.status);
    var market = await mr.json();

    var reqId = calcRequestId(proof, market);
    var bd = bizDate(market);
    var quotes = {};
    var totalPages = 1;

    for(var page=0; page<totalPages&&page<20; page++){
      var url='/api/nots/nepse-data/today-price?page='+page+'&size=500&businessDate='+bd;
      var resp = await fetch(url,{method:'POST',headers:Object.assign({},ah,{'Content-Type':'application/json'}),body:JSON.stringify({id:reqId})});
      if(!resp.ok) throw new Error('/today-price HTTP '+resp.status);
      var pl = await resp.json();
      totalPages = Math.max(1,Math.min(Number(pl.totalPages)||1,20));
      extractQuotes(pl, symbols, quotes, 0);
      if(Object.keys(quotes).length>=symbols.length||pl.last===true) break;
    }

    var indexData = null;
    try {
      var ir = await fetch('/api/nots/nepse-index',{headers:ah});
      if(ir.ok){
        var ip = await ir.json();
        var ia = Array.isArray(ip)?ip:[];
        var ie = ia.find(function(x){return String(x.index||'').toUpperCase().includes('NEPSE');})||ia[0];
        if(ie) indexData={currentValue:Number(ie.currentValue)||0,pointChange:Number(ie.change)||0,percentChange:Number(ie.perChange)||0};
      }
    } catch(e){}

    window.ReactNativeWebView.postMessage(JSON.stringify({type:'nepse_price_result',quotes:quotes,businessDate:bd,nepseIndexData:indexData}));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'nepse_price_error',error:String(e&&e.message?e.message:e)}));
  }
})(); true;
`;
}

async function fetchOfficialNepseTodayPrices(symbols: string[]) {
  const wantedSymbols = new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  const websiteHeaders = {
    Origin: 'https://www.nepalstock.com',
    Referer: 'https://www.nepalstock.com/today-price',
  };
  const proofResponse = await fetchWithTimeout(
    `${NEPSE_OFFICIAL_API_BASE_URL}/authenticate/prove`,
    12000,
    websiteHeaders,
  );
  if (!proofResponse.ok) {
    throw new Error(`/authenticate/prove: HTTP ${proofResponse.status}`);
  }

  const proof = asRecord(await proofResponse.json());
  const accessToken = stripNepseWebsiteToken(String(proof.accessToken || ''), proof.salt2);
  if (!accessToken) {
    throw new Error('/authenticate/prove: missing access token');
  }

  const authHeaders = {
    Authorization: `Salter ${accessToken}`,
    ...websiteHeaders,
  };
  const marketStatusResponse = await fetchWithTimeout(
    `${NEPSE_OFFICIAL_API_BASE_URL}/nots/nepse-data/market-open`,
    12000,
    authHeaders,
  );
  if (!marketStatusResponse.ok) {
    throw new Error(`/market-open: HTTP ${marketStatusResponse.status}`);
  }

  const marketStatus = asRecord(await marketStatusResponse.json());
  const requestId = nepseRequestId(proof, marketStatus);
  const businessDate = businessDateFromMarketStatus(marketStatus);
  const quoteMap = new Map<string, PriceQuote>();
  let totalPages = 1;

  for (let page = 0; page < totalPages && page < 20; page += 1) {
    const url = `${NEPSE_OFFICIAL_API_BASE_URL}/nots/nepse-data/today-price?page=${page}&size=500&businessDate=${businessDate}`;
    const response = await postJsonWithTimeout(url, { id: requestId }, authHeaders, 12000);
    if (!response.ok) {
      throw new Error(`/today-price: HTTP ${response.status}`);
    }

    const payload = asRecord(await response.json());
    totalPages = Math.max(1, Math.min(numberFromUnknown(payload.totalPages) || 1, 20));
    collectMarketQuotes(payload)
      .filter((quote) => wantedSymbols.has(quote.symbol))
      .forEach((quote) => {
        quoteMap.set(quote.symbol, quote);
      });

    if (quoteMap.size >= wantedSymbols.size || payload.last === true) {
      break;
    }
  }

  if (!quoteMap.size) {
    throw new Error('/today-price: no matching symbols');
  }

  let nepseIndexData: NepseIndexData | null = null;
  try {
    const indexResponse = await fetchWithTimeout(
      `${NEPSE_OFFICIAL_API_BASE_URL}/nots/nepse-index`,
      10000,
      authHeaders,
    );
    if (indexResponse.ok) {
      nepseIndexData = parseNepseIndex(await indexResponse.json());
    }
  } catch (e) {
    // Index fetch is best-effort — price data still returned
  }

  return {
    endpoint: `NEPSE today-price ${businessDate}`,
    quotes: quoteMap,
    nepseIndexData,
  };
}

async function fetchUnofficialNepsePrices(symbols: string[]) {
  const wantedSymbols = new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  const endpointErrors: string[] = [];

  for (const endpoint of NEPSE_UNOFFICIAL_PRICE_API_ENDPOINTS) {
    const url = `${NEPSE_UNOFFICIAL_PRICE_API_BASE_URL}${endpoint}`;

    try {
      const response = await fetchWithTimeout(url, 12000);
      if (!response.ok) {
        endpointErrors.push(`${endpoint}: HTTP ${response.status}`);
        continue;
      }

      const payload = await response.json();
      const quotes = collectMarketQuotes(payload)
        .filter((quote) => wantedSymbols.has(quote.symbol));
      const quoteMap = new Map<string, PriceQuote>();

      quotes.forEach((quote) => {
        quoteMap.set(quote.symbol, quote);
      });

      if (quoteMap.size) {
        return {
          endpoint,
          quotes: quoteMap,
          nepseIndexData: null,
        };
      }

      endpointErrors.push(`${endpoint}: no matching symbols`);
    } catch (error) {
      endpointErrors.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(endpointErrors.join(' | ') || 'No NEPSE price endpoint returned usable prices');
}

async function fetchLatestNepsePrices(symbols: string[]) {
  const officialErrors: string[] = [];

  try {
    return await fetchOfficialNepseTodayPrices(symbols);
  } catch (error) {
    officialErrors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    return await fetchUnofficialNepsePrices(symbols);
  } catch (error) {
    throw new Error(`Official NEPSE failed: ${officialErrors.join(' | ')}. Fallback failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function dateFromUnknown(value: unknown) {
  return String(value || '').split('T')[0];
}

function cashPriceForPurchaseSource(source: string, userPrice: number, rate: number) {
  const normalizedSource = source.toUpperCase();

  if (normalizedSource.includes('BONUS')) {
    return userPrice || rate || 100;
  }

  return userPrice || rate || 0;
}

function directWaccRows(wacc: unknown) {
  const response = asRecord(wacc);
  return asArray(response.waccUpdateResponse).map(asRecord);
}

function calculateCashBasisFromWaccRows(symbol: string, rows: Array<Record<string, unknown>>): CostBasis | null {
  let calculatedQuantity = 0;
  let totalCost = 0;

  rows.forEach((row) => {
    const quantity = numberFromUnknown(row.transactionQuantity);
    const purchaseSource = String(row.purchaseSource || '');
    const userPrice = numberFromUnknown(row.userPrice);
    const rate = numberFromUnknown(row.rate);
    const cashPrice = cashPriceForPurchaseSource(purchaseSource, userPrice, rate);

    calculatedQuantity += quantity;
    totalCost += quantity * cashPrice;
  });

  if (!symbol || calculatedQuantity <= 0) {
    return null;
  }

  return {
    symbol,
    calculatedQuantity,
    averageCost: totalCost / calculatedQuantity,
    totalCost,
    raw: {
      basis: 'cash-invested',
      rule: 'Purchase rows use userPrice then rate. BONUS falls back to Rs. 100 when MeroShare has no row price.',
    },
  };
}

function calculateMixedWaccBasis(
  symbol: string,
  wacc: unknown,
  rowBasis: CostBasis | null,
  holdingQuantity: number,
): CostBasis | null {
  const response = asRecord(wacc);
  const summary = asRecord(response.waccSummaryResponse);
  const summaryAverageCost = numberFromUnknown(summary.averageBuyRate);
  const summaryQuantity = numberFromUnknown(summary.totalQuantity);
  const rowQuantity = rowBasis?.calculatedQuantity || 0;
  const rowTotalCost = rowBasis?.totalCost || 0;
  const calculatedQuantity = holdingQuantity || rowQuantity + summaryQuantity;
  const summaryCoveredQuantity = Math.max(calculatedQuantity - rowQuantity, 0);
  const totalCost = rowTotalCost + summaryCoveredQuantity * summaryAverageCost;
  const averageCost = calculatedQuantity > 0 ? totalCost / calculatedQuantity : 0;

  if (!symbol || calculatedQuantity <= 0 || (!rowBasis && summaryAverageCost <= 0)) {
    return null;
  }

  return {
    symbol,
    calculatedQuantity,
    averageCost,
    totalCost,
    raw: {
      basis: 'mixed-purchase-source-and-wacc-summary',
      rule: 'Total holding quantity comes from portfolio holdings. MeroShare purchase rows are costed first, including BONUS at Rs. 100 fallback; remaining quantity is costed at waccSummaryResponse.averageBuyRate.',
      holdingQuantity,
      rowQuantity,
      rowTotalCost,
      summaryCoveredQuantity,
      summaryAverageCost,
      appCashBasis: rowBasis
        ? {
            calculatedQuantity: rowBasis.calculatedQuantity,
            averageCost: rowBasis.averageCost,
            totalCost: rowBasis.totalCost,
            rule: rowBasis.raw?.rule,
          }
        : null,
      meroShareWaccSummary: sanitizeForLog(summary),
      meroShareRows: sanitizeForLog(directWaccRows(wacc)),
    },
  };
}

function mixedCostBasisForHolding(record: CostBasis, holdingQuantity: number): CostBasis {
  const raw = asRecord(record.raw);
  const summary = asRecord(raw.meroShareWaccSummary);
  const rows = asArray(raw.meroShareRows).map(asRecord);

  if (!rows.length && !Object.keys(summary).length) {
    return record;
  }

  const rowBasis = calculateCashBasisFromWaccRows(record.symbol, rows);
  const mixedBasis = calculateMixedWaccBasis(
    record.symbol,
    {
      waccSummaryResponse: summary,
      waccUpdateResponse: rows,
    },
    rowBasis,
    holdingQuantity,
  );

  return mixedBasis
    ? {
        ...mixedBasis,
        accountId: record.accountId,
      }
    : record;
}

function preferMeroShareSummaryCostBasis(record: CostBasis): CostBasis {
  return record;
}

function directWaccToCostBasis(symbol: string, wacc: unknown, holdingQuantity = 0): CostBasis[] {
  const rows = directWaccRows(wacc);
  const cashBasis = calculateCashBasisFromWaccRows(symbol, rows);
  const mixedBasis = calculateMixedWaccBasis(symbol, wacc, cashBasis, holdingQuantity);

  if (mixedBasis) {
    return [mixedBasis];
  }

  if (cashBasis) {
    return [
      {
        ...cashBasis,
        raw: {
          ...(cashBasis.raw || {}),
          meroShareWaccSummary: sanitizeForLog(asRecord(asRecord(wacc).waccSummaryResponse)),
          meroShareRows: sanitizeForLog(rows),
        } as Record<string, string | string[]>,
      },
    ];
  }

  return [
    {
      symbol,
      calculatedQuantity: 0,
      averageCost: 0,
      totalCost: 0,
      raw: {
        basis: 'not-calculated',
        reason: 'MeroShare did not return purchase rows usable for cash-invested average cost.',
        meroShareWaccSummary: sanitizeForLog(asRecord(asRecord(wacc).waccSummaryResponse)),
        meroShareRows: sanitizeForLog(rows),
      } as Record<string, string | string[]>,
    },
  ];
}

function directWaccToPurchaseLots(symbol: string, wacc: unknown): PurchaseLot[] {
  return directWaccRows(wacc)
    .map((row): PurchaseLot | null => {
      const quantity = numberFromUnknown(row.transactionQuantity);
      const transactionDate = dateFromUnknown(row.transactionDate);
      const purchaseSource = String(row.purchaseSource || '');

      if (!symbol || quantity <= 0 || (!transactionDate && !purchaseSource)) {
        return null;
      }

      const userPrice = numberFromUnknown(row.userPrice);
      const rate = numberFromUnknown(row.rate);
      const cashPrice = cashPriceForPurchaseSource(purchaseSource, userPrice, rate);

      return {
        symbol,
        transactionDate,
        quantity,
        rate,
        purchaseSource,
        purchasePrice: cashPrice,
        totalCost: cashPrice * quantity,
        remarks: String(row.historyDescription || ''),
        raw: sanitizeForLog(row) as Record<string, string | string[]>,
      };
    })
    .filter((lot): lot is PurchaseLot => Boolean(lot));
}

function directWaccToHolding(symbol: string, wacc: unknown, holdingQuantity = 0): Holding | null {
  const response = asRecord(wacc);
  const summary = asRecord(response.waccSummaryResponse);
  const rows = directWaccRows(wacc);
  const cashBasis = calculateCashBasisFromWaccRows(symbol, rows);
  const mixedBasis = calculateMixedWaccBasis(symbol, wacc, cashBasis, holdingQuantity);
  const quantity = mixedBasis?.calculatedQuantity || cashBasis?.calculatedQuantity || numberFromUnknown(summary.totalQuantity);

  if (!symbol || quantity <= 0) {
    return null;
  }

  return {
    symbol,
    company: String(summary.scripName || symbol),
    quantity,
    averageCost: mixedBasis?.averageCost || cashBasis?.averageCost || 0,
    ltp: 0,
    source: mixedBasis ? 'MeroShare purchase rows + WACC summary' : 'MeroShare purchase rows',
    raw: sanitizeForLog({
      summary,
      mixedBasis,
      cashBasis,
    }),
  };
}

function mergeHoldingRecords(existing: Holding[], incoming: Holding[]) {
  const bySymbol = new Map(existing.map((holding) => [accountKey(holding.accountId, holding.symbol), holding]));

  incoming.forEach((holding) => {
    bySymbol.set(accountKey(holding.accountId, holding.symbol), {
      ...bySymbol.get(accountKey(holding.accountId, holding.symbol)),
      ...holding,
    });
  });

  return Array.from(bySymbol.values()).sort((a, b) => {
    const accountCompare = (a.accountId || '').localeCompare(b.accountId || '');
    if (accountCompare !== 0) return accountCompare;
    return a.symbol.localeCompare(b.symbol);
  });
}

function isLegacySavedAccount(account: Account) {
  return account.id === 'default' ||
    account.name === 'Saved account' ||
    account.dematMasked === 'Saved MeroShare';
}

function accountsReferToSameAccount(account: Account, incoming: Account) {
  const accountBoid = String(account.boid || '').trim();
  const incomingBoid = String(incoming.boid || '').trim();
  if (accountBoid && incomingBoid) {
    return accountBoid === incomingBoid;
  }

  const accountDemat = String(account.dematMasked || '').trim();
  const incomingDemat = String(incoming.dematMasked || '').trim();
  if (accountDemat && incomingDemat && accountDemat !== 'Saved MeroShare' && incomingDemat !== 'Saved MeroShare') {
    return accountDemat === incomingDemat;
  }

  if (account.id === 'default' || incoming.id === 'default') {
    return false;
  }

  return account.id === incoming.id;
}

function replacedAccountIdsForIncoming(accounts: Account[], incoming: Account) {
  return new Set(
    accounts
      .filter((account) => accountsReferToSameAccount(account, incoming) ||
        (isLegacySavedAccount(account) && !isLegacySavedAccount(incoming)))
      .map((account) => account.id),
  );
}

function recordBelongsToReplacedAccount(record: { accountId?: string }, replacedAccountIds: Set<string>) {
  const accountId = record.accountId || 'default';
  return replacedAccountIds.has(accountId);
}

function mergeAccountRecords(existing: Account[], incoming: Account) {
  const replacedIds = replacedAccountIdsForIncoming(existing, incoming);
  const accountToMerge = existing.find((account) => accountsReferToSameAccount(account, incoming));
  const byId = new Map(
    existing
      .filter((account) => account.id === incoming.id || !replacedIds.has(account.id))
      .map((account) => [account.id, account]),
  );
  byId.set(incoming.id, {
    ...accountToMerge,
    ...incoming,
  });

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeAccountRecords(accounts: Account[]) {
  return [...accounts]
    .sort((a, b) => Number(isLegacySavedAccount(b)) - Number(isLegacySavedAccount(a)))
    .reduce((merged, account) => mergeAccountRecords(merged, account), [] as Account[]);
}

function accountListSignature(accounts: Account[]) {
  return accounts
    .map((account) => [
      account.id,
      account.name,
      account.dematMasked,
      account.boid || '',
      account.clientCode || '',
      account.username || '',
      account.holdings,
    ].join(':'))
    .join('|');
}

function portfolioApiRowsToHoldings(rows: unknown[]): Holding[] {
  return rows
    .map((row): Holding | null => {
      const item = asRecord(row);
      const symbol = String(item.script || '').trim().toUpperCase();
      const quantity = numberFromUnknown(item.currentBalance);

      if (!symbol || quantity <= 0) {
        return null;
      }

      const ltp = numberFromUnknown(item.lastTransactionPrice) ||
        numberFromUnknown(item.previousClosingPrice);

      return {
        symbol,
        company: String(item.scriptDesc || symbol).trim(),
        quantity,
        averageCost: 0,
        ltp,
        source: 'MeroShare portfolio API',
        raw: sanitizeForLog(item),
      };
    })
    .filter((holding): holding is Holding => Boolean(holding));
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const nepseWebViewRef = useRef<WebView>(null);
  const nepseWebViewPromiseRef = useRef<{
    resolve: (result: { endpoint: string; quotes: Map<string, PriceQuote>; nepseIndexData: NepseIndexData | null }) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const nepseWebViewSymbolsRef = useRef<string[]>([]);
  const isApiProbingRef = useRef(false);
  const autoSyncStartedRef = useRef(false);
  const directSyncModeRef = useRef<DirectSyncMode | null>(null);
  const latestPriceRefreshKeyRef = useRef('');
  const latestAnalysisExportSignatureRef = useRef('');
  const exportButtonHomeRef = useRef<View>(null);
  const exportButtonAccountRef = useRef<View>(null);
  const exportOnCSVRef = useRef<(() => void) | null>(null);
  const exportOnPLRef = useRef<(() => void) | null>(null);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isPriceFetchWebViewOpen, setIsPriceFetchWebViewOpen] = useState(false);
  const [isWebViewLoading, setIsWebViewLoading] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(MEROSHARE_URL);
  const [syncedHoldings, setSyncedHoldings] = useState<Holding[]>([]);
  const [costBasisRecords, setCostBasisRecords] = useState<CostBasis[]>([]);
  const [purchaseLotRecords, setPurchaseLotRecords] = useState<PurchaseLot[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [isApiProbing, setIsApiProbing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCapture, setLastCapture] = useState('No MeroShare report downloaded yet');
  const [priceSyncedAt, setPriceSyncedAt] = useState<string | null>(null);
  const [priceStatus, setPriceStatus] = useState('Latest prices will update after holdings load.');
  const [isPriceRefreshing, setIsPriceRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('Open MeroShare and tap its official report download.');
  const [networkRecords, setNetworkRecords] = useState<MeroShareNetworkLogPayload[]>([]);
  const [hasLoadedCachedPortfolio, setHasLoadedCachedPortfolio] = useState(false);
  const [selectedAccountDetailId, setSelectedAccountDetailId] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [consolidatedSearchQuery, setConsolidatedSearchQuery] = useState('');
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [activeSearchScope, setActiveSearchScope] = useState<'home' | 'account' | null>(null);
  const [consolidatedSortOption, setConsolidatedSortOption] = useState<SortOption>('alphabetical');
  const [accountSortOption, setAccountSortOption] = useState<SortOption>('alphabetical');
  const [openSortScope, setOpenSortScope] = useState<'home' | 'account' | null>(null);
  const [exportMenuVisible, setExportMenuVisible] = useState(false);
  const [exportMenuTop, setExportMenuTop] = useState(0);
  const [nepseIndexData, setNepseIndexData] = useState<NepseIndexData | null>(null);
  const [apiProbeSummary, setApiProbeSummary] = useState<ApiProbeSummary>({
    status: 'idle',
    symbol: '',
    message: 'No API probe run yet',
    recordCount: 0,
    responseCount: 0,
    endpoints: [],
  });
  const [directApiSummary, setDirectApiSummary] = useState<DirectApiSummary>({
    status: 'idle',
    symbol: '',
    message: 'No direct API call run yet',
    dematMasked: '',
  });
  const [autoScanSummary, setAutoScanSummary] = useState<AutoScanSummary>({
    symbol: '',
    status: 'idle',
    message: 'No Auto 1 scan run yet',
    tableCount: 0,
    waccCount: 0,
    lotCount: 0,
  });

  const holdings = useMemo(
    () => mergeCostBasisIntoHoldings(syncedHoldings, costBasisRecords),
    [costBasisRecords, syncedHoldings],
  );
  const analysisExportSignature = useMemo(
    () => JSON.stringify({
      accounts: accountListSignature(accounts),
      holdings: holdings.map((holding) => [
        holding.accountId || '',
        holding.symbol,
        holding.quantity,
        holding.averageCost,
        holding.ltp,
      ]),
      costBasisRecords: costBasisRecords.map((record) => [
        record.accountId || '',
        record.symbol,
        record.calculatedQuantity,
        record.averageCost,
        record.totalCost,
      ]),
      purchaseLotRecords: purchaseLotRecords.map((lot) => [
        lot.accountId || '',
        lot.symbol,
        lot.transactionDate,
        lot.quantity,
        lot.purchasePrice,
        lot.totalCost,
      ]),
    }),
    [accounts, costBasisRecords, holdings, purchaseLotRecords],
  );
  const hasRealAccounts = accounts.some((account) => !isLegacySavedAccount(account));
  const portfolioHoldings = useMemo(
    () => hasRealAccounts
      ? holdings.filter((holding) => !isLegacyAccountId(holding.accountId))
      : holdings,
    [hasRealAccounts, holdings],
  );
  const priceRefreshSymbols = useMemo(
    () => Array.from(new Set(portfolioHoldings.map((holding) => holding.symbol))).sort(),
    [portfolioHoldings],
  );
  const priceRefreshKey = priceRefreshSymbols.join('|');
  const consolidatedHoldings = useMemo(
    () => consolidateHoldings(portfolioHoldings),
    [portfolioHoldings],
  );
  const effectiveActiveAccountId = accounts.some((account) => account.id === activeAccountId)
    ? activeAccountId
    : accounts[0]?.id || null;
  const activeAccount = accounts.find((account) => account.id === effectiveActiveAccountId) || null;
  const selectedAccountDetail = accounts.find((account) => account.id === selectedAccountDetailId) || null;
  const accountHoldings = useMemo(
    () => recordsForAccount(holdings, effectiveActiveAccountId),
    [effectiveActiveAccountId, holdings],
  );
  const filteredAccountHoldings = useMemo(
    () => sortHoldings(
      accountHoldings.filter((holding) => holdingMatchesSearch(holding, accountSearchQuery)),
      accountSortOption,
    ),
    [accountHoldings, accountSearchQuery, accountSortOption],
  );
  const filteredConsolidatedHoldings = useMemo(
    () => sortHoldings(
      consolidatedHoldings.filter((holding) => holdingMatchesSearch(holding, consolidatedSearchQuery)),
      consolidatedSortOption,
    ),
    [consolidatedHoldings, consolidatedSearchQuery, consolidatedSortOption],
  );
  const portfolioSymbols = useMemo(
    () => Array.from(new Set(accountHoldings.map((holding) => holding.symbol))).sort(),
    [accountHoldings],
  );
  const accountCostBasisRecords = useMemo(
    () => recordsForAccount(costBasisRecords, effectiveActiveAccountId),
    [costBasisRecords, effectiveActiveAccountId],
  );
  const accountPurchaseLotRecords = useMemo(
    () => recordsForAccount(purchaseLotRecords, effectiveActiveAccountId),
    [effectiveActiveAccountId, purchaseLotRecords],
  );
  const selectedShareAccountBreakdowns = useMemo(() => {
    if (!selectedSymbol) {
      return [];
    }

    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const sourceHoldings = selectedAccountDetailId
      ? recordsForAccount(holdings, selectedAccountDetailId)
      : portfolioHoldings;

    return sourceHoldings
      .filter((holding) => holding.symbol === selectedSymbol)
      .map((holding) => {
        const accountId = holding.accountId || 'default';
        const account = accountById.get(accountId) || {
          id: accountId,
          name: accountId === 'default' ? 'Saved account' : 'Unknown demat account',
          dematMasked: accountId === 'default' ? 'Saved MeroShare' : accountId,
          holdings: 0,
          syncedAt: '',
        };
        const scopedCostBasisRecords = recordsForAccount(costBasisRecords, accountId);
        const scopedPurchaseLotRecords = recordsForAccount(purchaseLotRecords, accountId);
        const coverage = purchaseSourceCoverageForHoldings(
          [holding],
          scopedCostBasisRecords,
          scopedPurchaseLotRecords,
        )[0];
        const cost = holding.quantity * holding.averageCost;
        const value = holding.quantity * holding.ltp;
        const profitLoss = value - cost;

        return {
          account,
          holding,
          coverage,
          cost,
          value,
          profitLoss,
          profitLossPercent: cost > 0 ? (profitLoss / cost) * 100 : 0,
        };
      });
  }, [
    accounts,
    costBasisRecords,
    holdings,
    portfolioHoldings,
    purchaseLotRecords,
    selectedAccountDetailId,
    selectedSymbol,
  ]);
  const selectedHolding = useMemo(
    () => {
      if (!selectedSymbol) {
        return null;
      }

      if (selectedAccountDetailId) {
        return selectedShareAccountBreakdowns[0]?.holding || null;
      }

      return consolidatedHoldings.find((holding) => holding.symbol === selectedSymbol) ||
        selectedShareAccountBreakdowns[0]?.holding ||
        null;
    },
    [consolidatedHoldings, selectedAccountDetailId, selectedShareAccountBreakdowns, selectedSymbol],
  );
  const selectedCostBasis = useMemo(
    () => {
      if (!selectedAccountDetailId) {
        return null;
      }

      const record = accountCostBasisRecords.find((item) => item.symbol === selectedSymbol);
      if (!record) {
        return null;
      }

      return selectedHolding
        ? mixedCostBasisForHolding(record, selectedHolding.quantity)
        : record;
    },
    [accountCostBasisRecords, selectedAccountDetailId, selectedHolding, selectedSymbol],
  );
  const selectedPurchaseLots = useMemo(
    () => {
      const sourceLots = selectedAccountDetailId ? accountPurchaseLotRecords : purchaseLotRecords;
      return sourceLots.filter((lot) => lot.symbol === selectedSymbol);
    },
    [accountPurchaseLotRecords, purchaseLotRecords, selectedAccountDetailId, selectedSymbol],
  );
  const purchaseSourceCoverage = useMemo(() => {
    const costBasisBySymbol = new Map(accountCostBasisRecords.map((record) => [record.symbol, record]));
    const lotCountBySymbol = accountPurchaseLotRecords.reduce((counts, lot) => {
      counts.set(lot.symbol, (counts.get(lot.symbol) || 0) + 1);
      return counts;
    }, new Map<string, number>());

    return accountHoldings.map((holding) => {
      const record = costBasisBySymbol.get(holding.symbol);
      const raw = asRecord(record?.raw);
      const meroShareRows = asArray(raw.meroShareRows);
      const summary = asRecord(raw.meroShareWaccSummary);
      const rowCount = lotCountBySymbol.get(holding.symbol) || meroShareRows.length;
      const rowQuantity: number = numberFromUnknown(raw.rowQuantity) ||
        meroShareRows.reduce<number>(
          (total, row) => total + numberFromUnknown(asRecord(row).transactionQuantity),
          0,
        );
      const summaryQuantity = numberFromUnknown(summary.totalQuantity);
      const remainingQuantity = Math.max(holding.quantity - rowQuantity, 0);
      const uncoveredQuantity = Math.max(remainingQuantity - summaryQuantity, 0);
      const excessRowQuantity = Math.max(rowQuantity - holding.quantity, 0);
      const hasSummary = numberFromUnknown(summary.averageBuyRate) > 0 ||
        summaryQuantity > 0;

      return {
        symbol: holding.symbol,
        holdingQuantity: holding.quantity,
        rowCount,
        rowQuantity,
        summaryQuantity,
        remainingQuantity,
        uncoveredQuantity,
        excessRowQuantity,
        hasSummary,
        hasNoPurchaseSourceRows: rowCount === 0,
        hasNoPurchaseSourceData: rowCount === 0 && !hasSummary,
        hasQuantityMismatch: uncoveredQuantity > 0.0001 || excessRowQuantity > 0.0001,
      };
    });
  }, [accountCostBasisRecords, accountHoldings, accountPurchaseLotRecords]);
  const coverageValidationRows = useMemo(
    () => purchaseSourceCoverage.map((item) => ({
      symbol: item.symbol,
      held: item.holdingQuantity,
      purchaseRows: item.rowQuantity,
      remainingForSummary: item.remainingQuantity,
      waccSummary: item.summaryQuantity,
      uncovered: item.uncoveredQuantity,
      extraRows: item.excessRowQuantity,
      status: item.hasQuantityMismatch ? 'warning' : 'ok',
    })),
    [purchaseSourceCoverage],
  );
  const totals = useMemo(() => getPortfolioTotals(consolidatedHoldings), [consolidatedHoldings]);
  const accountTotals = useMemo(() => getPortfolioTotals(accountHoldings), [accountHoldings]);
  const accountProfitLoss = accountTotals.value - accountTotals.cost;
  const accountProfitLossPercent = accountTotals.cost > 0 ? (accountProfitLoss / accountTotals.cost) * 100 : 0;
  const accountTotalQuantity = accountHoldings.reduce((total, holding) => total + holding.quantity, 0);
  const accountWarnings = purchaseSourceCoverage.flatMap((item) => [
    item.hasNoPurchaseSourceData
      ? {
        title: `${item.symbol}: no purchase source data`,
        message: 'No purchase source table and no WACC summary were stored for this share.',
      }
      : null,
    item.hasQuantityMismatch
      ? {
        title: `${item.symbol}: quantity coverage mismatch`,
        message: item.excessRowQuantity > 0
          ? `${formatDecimal(item.holdingQuantity)} held, ${formatDecimal(item.rowQuantity)} purchase-source rows, extra rows ${formatDecimal(item.excessRowQuantity)}.`
          : `${formatDecimal(item.holdingQuantity)} held, ${formatDecimal(item.rowQuantity)} purchase-source rows, ${formatDecimal(item.summaryQuantity)} WACC summary, uncovered ${formatDecimal(item.uncoveredQuantity)}.`,
      }
      : null,
  ]).filter((warning): warning is { title: string; message: string } => Boolean(warning));
  const profitLoss = totals.value - totals.cost;
  const profitLossPercent = totals.cost > 0 ? (profitLoss / totals.cost) * 100 : 0;
  const totalQuantity = consolidatedHoldings.reduce((total, holding) => total + holding.quantity, 0);

  useEffect(() => {
    let isActive = true;

    async function loadCachedPortfolio() {
      try {
        const fileInfo = await FileSystem.getInfoAsync(PORTFOLIO_CACHE_URI);
        if (!fileInfo.exists) {
          return;
        }

        const rawCache = await FileSystem.readAsStringAsync(PORTFOLIO_CACHE_URI);
        const cache = JSON.parse(rawCache) as Partial<PersistedPortfolioState>;
        if (!isActive) {
          return;
        }

        const cachedHoldings = Array.isArray(cache.syncedHoldings) ? cache.syncedHoldings : [];
        const cachedCostBasisRecords = Array.isArray(cache.costBasisRecords)
          ? cache.costBasisRecords.map(preferMeroShareSummaryCostBasis)
          : [];
        const cachedPurchaseLotRecords = Array.isArray(cache.purchaseLotRecords) ? cache.purchaseLotRecords : [];
        let cachedAccounts: Account[] = [];

        if (Array.isArray(cache.syncedHoldings)) {
          setSyncedHoldings(cachedHoldings);
        }
        if (Array.isArray(cache.costBasisRecords)) {
          setCostBasisRecords(cachedCostBasisRecords);
        }
        if (Array.isArray(cache.purchaseLotRecords)) {
          setPurchaseLotRecords(cachedPurchaseLotRecords);
        }
        if (Array.isArray(cache.accounts) && cache.accounts.length) {
          cachedAccounts = normalizeAccountRecords(cache.accounts);
          setAccounts(cachedAccounts);
          setActiveAccountId(cache.activeAccountId || cachedAccounts[0].id);
        } else if (Array.isArray(cache.syncedHoldings) && cache.syncedHoldings.length) {
          cachedAccounts = [
            {
              id: 'default',
              name: 'Saved account',
              dematMasked: 'Saved MeroShare',
              holdings: cache.syncedHoldings.length,
              syncedAt: cache.syncedAt || 'Saved earlier',
            },
          ];
          setAccounts(cachedAccounts);
          setActiveAccountId('default');
        }
        setLastCapture(
          cache.syncedHoldings?.length
            ? `Restored ${cache.syncedHoldings.length} holdings from phone storage`
            : cache.lastCapture || 'Loaded saved MeroShare cache',
        );
        if (cache.priceSyncedAt) {
          setPriceSyncedAt(cache.priceSyncedAt);
          setPriceStatus('Loaded saved latest prices');
        }
        if (cachedAccounts.length && cachedHoldings.length) {
          const cachedMergedHoldings = mergeCostBasisIntoHoldings(cachedHoldings, cachedCostBasisRecords);
          writeAccountAnalysisExports(
            cachedAccounts,
            cachedMergedHoldings,
            cachedCostBasisRecords,
            cachedPurchaseLotRecords,
          )
            .then((exports) => {
              logLarge('Portfolio analysis export index from cache restore', {
                exportedAccounts: exports.length,
                exports,
              });
            })
            .catch((error) => {
              console.log('[Portfolio Analysis Export] Cache restore export failed', error);
            });
        }
      } catch (error) {
        console.log('[MeroShare Sync] Portfolio cache restore failed', error);
      } finally {
        if (isActive) {
          setHasLoadedCachedPortfolio(true);
        }
      }
    }

    loadCachedPortfolio();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!accounts.length) {
      return;
    }

    const normalizedAccounts = normalizeAccountRecords(accounts);
    if (accountListSignature(normalizedAccounts) === accountListSignature(accounts)) {
      return;
    }

    const normalizedIds = new Set(normalizedAccounts.map((account) => account.id));
    const removedIds = new Set(accounts.filter((account) => !normalizedIds.has(account.id)).map((account) => account.id));
    setAccounts(normalizedAccounts);

    if (activeAccountId && !normalizedIds.has(activeAccountId)) {
      setActiveAccountId(normalizedAccounts[0]?.id || null);
    }
    if (selectedAccountDetailId && !normalizedIds.has(selectedAccountDetailId)) {
      setSelectedAccountDetailId(null);
    }

    setSyncedHoldings((current) => current.filter((holding) => !recordBelongsToReplacedAccount(holding, removedIds)));
    setCostBasisRecords((current) => current.filter((record) => !recordBelongsToReplacedAccount(record, removedIds)));
    setPurchaseLotRecords((current) => current.filter((lot) => !recordBelongsToReplacedAccount(lot, removedIds)));
  }, [accounts, activeAccountId, selectedAccountDetailId]);

  useEffect(() => {
    if (!hasRealAccounts) {
      return;
    }

    setSyncedHoldings((current) => {
      const next = current.filter((holding) => !isLegacyAccountId(holding.accountId));
      return next.length === current.length ? current : next;
    });
    setCostBasisRecords((current) => {
      const next = current.filter((record) => !isLegacyAccountId(record.accountId));
      return next.length === current.length ? current : next;
    });
    setPurchaseLotRecords((current) => {
      const next = current.filter((lot) => !isLegacyAccountId(lot.accountId));
      return next.length === current.length ? current : next;
    });
  }, [hasRealAccounts]);

  useEffect(() => {
    if (!hasLoadedCachedPortfolio) {
      return;
    }

    if (!syncedHoldings.length && !costBasisRecords.length && !purchaseLotRecords.length) {
      return;
    }

    const saveTimer = setTimeout(() => {
      const snapshot: PersistedPortfolioState = {
        syncedAt: new Date().toISOString(),
        accounts,
        activeAccountId: effectiveActiveAccountId,
        syncedHoldings,
        costBasisRecords,
        purchaseLotRecords,
        lastCapture,
        priceSyncedAt,
      };

      FileSystem.writeAsStringAsync(PORTFOLIO_CACHE_URI, JSON.stringify(snapshot)).catch((error) => {
        console.log('[MeroShare Sync] Portfolio cache save failed', error);
      });
    }, 600);

    return () => clearTimeout(saveTimer);
  }, [
    accounts,
    costBasisRecords,
    effectiveActiveAccountId,
    hasLoadedCachedPortfolio,
    lastCapture,
    priceSyncedAt,
    purchaseLotRecords,
    syncedHoldings,
  ]);

  useEffect(() => {
    if (!hasLoadedCachedPortfolio || !accounts.length || !holdings.length) {
      return;
    }

    if (latestAnalysisExportSignatureRef.current === analysisExportSignature) {
      return;
    }

    latestAnalysisExportSignatureRef.current = analysisExportSignature;
    const exportTimer = setTimeout(() => {
      writeAccountAnalysisExports(accounts, holdings, costBasisRecords, purchaseLotRecords)
        .then((exports) => {
          logLarge('Portfolio analysis export index', {
            exportedAccounts: exports.length,
            exports,
          });
        })
        .catch((error) => {
          console.log('[Portfolio Analysis Export] Failed', error);
        });
    }, 1200);

    return () => clearTimeout(exportTimer);
  }, [
    accounts,
    analysisExportSignature,
    costBasisRecords,
    hasLoadedCachedPortfolio,
    holdings,
    purchaseLotRecords,
  ]);

  useEffect(() => {
    if (!hasLoadedCachedPortfolio || !priceRefreshKey || isSyncOpen) {
      return;
    }

    if (latestPriceRefreshKeyRef.current === priceRefreshKey) {
      return;
    }

    latestPriceRefreshKeyRef.current = priceRefreshKey;
    refreshLatestPrices(priceRefreshSymbols);
  }, [hasLoadedCachedPortfolio, isSyncOpen, priceRefreshKey, priceRefreshSymbols]);

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }

    const hasSelectedSymbol = selectedAccountDetailId
      ? recordsForAccount(holdings, selectedAccountDetailId).some((holding) => holding.symbol === selectedSymbol)
      : consolidatedHoldings.some((holding) => holding.symbol === selectedSymbol);

    if (!hasSelectedSymbol) {
      setSelectedSymbol(null);
    }
  }, [consolidatedHoldings, holdings, selectedAccountDetailId, selectedSymbol]);

  useEffect(() => {
    if (selectedAccountDetailId && !selectedAccountDetail) {
      setSelectedAccountDetailId(null);
    }
  }, [selectedAccountDetail, selectedAccountDetailId]);

  useEffect(() => {
    if (!selectedAccountDetail || !coverageValidationRows.length) {
      return;
    }

    logLarge('WACC quantity coverage validation', {
      account: selectedAccountDetail.name,
      demat: selectedAccountDetail.dematMasked,
      totalSymbols: coverageValidationRows.length,
      warningCount: coverageValidationRows.filter((row) => row.status === 'warning').length,
      rows: coverageValidationRows,
    });
  }, [coverageValidationRows, selectedAccountDetail]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedSymbol) {
        setSelectedSymbol(null);
        return true;
      }

      if (activeSearchScope) {
        setActiveSearchScope(null);
        return true;
      }

      if (selectedAccountDetailId) {
        setSelectedAccountDetailId(null);
        return true;
      }

      if (isSyncOpen) {
        setIsSyncOpen(false);
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [activeSearchScope, isSyncOpen, selectedAccountDetailId, selectedSymbol]);

  function captureMeroSharePage() {
    console.log(`[MeroShare Sync] Capture requested for ${currentUrl}`);
    if (isLoginUrl(currentUrl)) {
      setLastCapture('Login page detected. Capture is paused until after login.');
      setDownloadStatus('Log in first, then capture portfolio or purchase-source pages.');
      return;
    }

    setIsCapturing(true);
    setLastCapture('Capturing current MeroShare page...');
    setDownloadStatus('Reading visible tables and buttons now.');
    webViewRef.current?.injectJavaScript(MEROSHARE_NETWORK_LOGGER_SCRIPT);
    webViewRef.current?.injectJavaScript(EXTRACT_MEROSHARE_SCRIPT);
    setTimeout(() => setIsCapturing(false), 3500);
  }

  function testSelectedStock() {
    console.log(`[MeroShare Sync] Selected stock test requested for ${currentUrl}`);
    if (isLoginUrl(currentUrl)) {
      setLastCapture('Login page detected. Test Stock is available after login.');
      setDownloadStatus('Open My Purchase Source after login, then test a selected stock.');
      return;
    }

    setIsCapturing(true);
    setLastCapture('Testing selected stock on this page...');
    setDownloadStatus('If you just pressed Search, this will capture the visible WACC/source table.');
    webViewRef.current?.injectJavaScript(MEROSHARE_NETWORK_LOGGER_SCRIPT);
    webViewRef.current?.injectJavaScript(EXTRACT_MEROSHARE_SCRIPT);
    setTimeout(() => setIsCapturing(false), 3500);
  }

  function inspectMeroShareForm() {
    console.log(`[MeroShare Sync] Form inspection requested for ${currentUrl}`);
    if (isLoginUrl(currentUrl)) {
      setLastCapture('Login page detected. Form inspection is available after login.');
      setDownloadStatus('Open My Purchase Source after login, then inspect the form.');
      return;
    }

    setIsCapturing(true);
    setLastCapture('Inspecting MeroShare form DOM...');
    setDownloadStatus('Reading inputs, dropdowns, form groups, and nearby HTML now.');
    webViewRef.current?.injectJavaScript(MEROSHARE_FORM_INSPECTOR_SCRIPT);
    setTimeout(() => setIsCapturing(false), 2500);
  }

  function dumpNetworkSnapshot() {
    setLastCapture('Reading compact MeroShare network snapshot...');
    setDownloadStatus('The snapshot will appear here and in Metro logs.');
    webViewRef.current?.injectJavaScript(MEROSHARE_NETWORK_LOGGER_SCRIPT);
    webViewRef.current?.injectJavaScript(MEROSHARE_NETWORK_SNAPSHOT_SCRIPT);
  }

  function addCostBasisRecords(records: CostBasis[]) {
    if (!records.length) {
      return;
    }

    setCostBasisRecords((current) => mergeCostBasisRecords(current, records));
  }

  function addPurchaseLotRecords(records: PurchaseLot[]) {
    if (!records.length) {
      return;
    }

    setPurchaseLotRecords((current) => mergePurchaseLotRecords(current, records));
  }

  function startAutoWaccScan(mode: DirectSyncMode = 'full') {
    directSyncModeRef.current = mode;
    autoSyncStartedRef.current = true;
    setIsAutoScanning(true);
    setIsApiProbing(false);
    isApiProbingRef.current = false;
    const existingSymbols = mode === 'auto' || mode === 'full' ? [] : portfolioSymbols;
    setDirectApiSummary({
      status: 'running',
      symbol: existingSymbols.length ? `${existingSymbols.length} symbols` : 'Portfolio API',
      message: existingSymbols.length
        ? 'Looping direct WACC API for imported holdings'
        : 'Pulling your holdings, then pulling your costs',
      dematMasked: '',
      total: existingSymbols.length || undefined,
      completed: 0,
      failed: 0,
    });
    setAutoScanSummary({
      symbol: existingSymbols.length ? `${existingSymbols.length} symbols` : 'Portfolio API',
      status: 'running',
      message: existingSymbols.length
        ? 'Direct WACC cost sync started'
        : 'Pulling your holdings from MeroShare',
      tableCount: 0,
      waccCount: 0,
      lotCount: 0,
      lastStep: existingSymbols.length ? 'direct-api-loop-start' : 'portfolio-api-start',
    });
    setLastCapture(
      existingSymbols.length
        ? `Starting direct WACC API sync for ${existingSymbols.length} symbols`
        : 'Pulling your holdings from MeroShare',
    );
    setDownloadStatus('Next: pulling your cost basis and purchase lots.');
    logLarge('Starting direct MeroShare full API sync', {
      url: currentUrl,
      total: existingSymbols.length,
      symbols: existingSymbols,
      portfolioApiFirst: !existingSymbols.length,
    });
    webViewRef.current?.injectJavaScript(createMeroShareDirectApiScript(existingSymbols));
  }

  function maybeStartAutoSync(url: string) {
    if (!isLoggedInMeroShareUrl(url)) {
      return;
    }

    if (!url.includes('#/purchase')) {
      setLastCapture('Logged in. Opening Purchase Source for sync...');
      setDownloadStatus('Preparing MeroShare before pulling holdings and cost basis.');
      webViewRef.current?.injectJavaScript("window.location.hash = '#/purchase'; true;");
      return;
    }

    if (autoSyncStartedRef.current) {
      return;
    }

    autoSyncStartedRef.current = true;
    setLastCapture('Logged in. Pulling your holdings...');
    setDownloadStatus('Please wait while the app pulls holdings and cost basis.');
    setTimeout(() => startAutoWaccScan('auto'), 1800);
  }

  function openMeroShareSync() {
    autoSyncStartedRef.current = false;
    directSyncModeRef.current = null;
    setShowDiagnostics(false);
    setIsSyncOpen(true);
    setLastCapture('Open MeroShare and log in to start automatic sync.');
    setDownloadStatus('After login, the app will pull holdings and cost basis automatically.');
  }

  function startSingleAutoWaccScan() {
    const symbol = portfolioSymbols[0] || 'AHPC';
    directSyncModeRef.current = 'single';

    if (isLoginUrl(currentUrl)) {
      setLastCapture('Login page detected. Direct API is available after login.');
      setDownloadStatus('Open My Purchase Source after login, then run Auto 1.');
      return;
    }

    setIsAutoScanning(true);
    setIsApiProbing(false);
    isApiProbingRef.current = false;
    setNetworkRecords([]);
    setDirectApiSummary({
      status: 'running',
      symbol,
      message: 'Calling ownDetail API, then WACC API',
      dematMasked: '',
    });
    setApiProbeSummary({
      status: 'idle',
      symbol,
      message: 'Direct API call is running; network probe not needed',
      recordCount: 0,
      responseCount: 0,
      endpoints: [],
    });
    setAutoScanSummary({
      symbol,
      status: 'running',
      message: 'Direct API started',
      tableCount: 0,
      waccCount: 0,
      lotCount: 0,
      lastStep: 'direct-api-start',
    });
    setLastCapture(`Starting direct MeroShare API call for ${symbol}`);
    setDownloadStatus('Using ownDetail to get demat, then calling WACC API.');
    logLarge('DIRECT API STARTED - Auto 1 MeroShare ownDetail plus WACC', {
      url: currentUrl,
      symbol,
    });
    webViewRef.current?.injectJavaScript(createMeroShareDirectApiScript(symbol));
  }

  function startApiProbeScan() {
    const symbol = portfolioSymbols[0] || 'AHPC';

    if (isLoginUrl(currentUrl)) {
      setLastCapture('Login page detected. API Probe is available after login.');
      setDownloadStatus('Open My Purchase Source after login, then run API Probe 1.');
      return;
    }

    setIsAutoScanning(true);
    setIsApiProbing(true);
    isApiProbingRef.current = true;
    setNetworkRecords([]);
    setApiProbeSummary({
      status: 'running',
      symbol,
      message: 'API Probe 1 is running',
      recordCount: 0,
      responseCount: 0,
      endpoints: [],
    });
    setAutoScanSummary({
      symbol,
      status: 'running',
      message: 'API Probe 1 started',
      tableCount: 0,
      waccCount: 0,
      lotCount: 0,
      lastStep: 'api-probe-start',
    });
    setLastCapture(`Starting one-symbol API probe for ${symbol}`);
    setDownloadStatus('Stay on My Purchase Source. The app will capture network calls from one search.');
    logLarge('API PROBE STARTED - one-symbol MeroShare API probe', {
      url: currentUrl,
      symbol,
    });
    webViewRef.current?.injectJavaScript(
      createMeroShareAutoScanScript([symbol], { networkProbe: true }),
    );
  }

  async function handleFileDownload(event: FileDownloadEvent) {
    const { downloadUrl } = event.nativeEvent;
    setDownloadStatus('Downloading MeroShare report...');
    setLastCapture(`Download detected: ${downloadUrl}`);

    try {
      const parsedReport = await downloadAndParseReport(downloadUrl);

      logLarge('Downloaded report metadata', {
        fileName: parsedReport.fileName,
        localUri: parsedReport.localUri,
        rowCount: parsedReport.rows.length,
        holdingCount: parsedReport.holdings.length,
        costBasisCount: parsedReport.costBasis.length,
        purchaseLotCount: parsedReport.purchaseLots.length,
      });
      logLarge('Downloaded report raw text', parsedReport.rawText);
      logLarge('Downloaded report parsed rows', parsedReport.rows);
      logLarge('Downloaded report normalized holdings', parsedReport.holdings);
      logLarge('Downloaded report cost basis records', parsedReport.costBasis);
      logLarge('Downloaded report purchase lots', parsedReport.purchaseLots);

      setLastCapture(
        `${parsedReport.holdings.length} holdings parsed from ${parsedReport.fileName}`,
      );
      setDownloadStatus(`Saved report to app storage: ${parsedReport.fileName}`);

      if (parsedReport.holdings.length > 0 && rowsContainPortfolioHoldings(parsedReport.rows)) {
        setSyncedHoldings(parsedReport.holdings);
      }

      addCostBasisRecords(parsedReport.costBasis);
      addPurchaseLotRecords(parsedReport.purchaseLots);
    } catch (error) {
      console.log('[MeroShare Sync] Report download/parse failed');
      console.log(error);
      setDownloadStatus('Report download failed. Check Metro terminal logs.');
      setLastCapture(error instanceof Error ? error.message : 'Unknown report download error');
    }
  }

  async function handleBlobDownload(payload: MeroShareBlobDownloadPayload) {
    setDownloadStatus('Reading MeroShare CSV blob...');
    setLastCapture(`Blob CSV detected: ${payload.fileName || payload.href}`);

    try {
      const parsedReport = await parseReportText(payload.fileName, payload.text);

      logLarge('Blob report metadata', {
        fileName: parsedReport.fileName,
        localUri: parsedReport.localUri,
        sourceUrl: payload.url,
        href: payload.href,
        mimeType: payload.mimeType,
        size: payload.size,
        rowCount: parsedReport.rows.length,
        holdingCount: parsedReport.holdings.length,
        costBasisCount: parsedReport.costBasis.length,
        purchaseLotCount: parsedReport.purchaseLots.length,
      });
      logLarge('Blob report raw text', parsedReport.rawText);
      logLarge('Blob report parsed rows', parsedReport.rows);
      logLarge('Blob report normalized holdings', parsedReport.holdings);
      logLarge('Blob report cost basis records', parsedReport.costBasis);
      logLarge('Blob report purchase lots', parsedReport.purchaseLots);

      setLastCapture(`${parsedReport.holdings.length} holdings parsed from ${parsedReport.fileName}`);
      setDownloadStatus(`Imported browser-generated CSV: ${parsedReport.fileName}`);

      if (parsedReport.holdings.length > 0 && rowsContainPortfolioHoldings(parsedReport.rows)) {
        setSyncedHoldings(parsedReport.holdings);
      }

      addCostBasisRecords(parsedReport.costBasis);
      addPurchaseLotRecords(parsedReport.purchaseLots);
    } catch (error) {
      console.log('[MeroShare Sync] Blob report parse failed');
      console.log(error);
      logLarge('Blob report raw text that failed parsing', payload.text);
      setDownloadStatus('Blob report parsing failed. Check Metro terminal logs.');
      setLastCapture(error instanceof Error ? error.message : 'Unknown blob report parse error');
    }
  }

  function handleWebViewMessage(event: WebViewMessageEvent) {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as
        | ExtractionPayload
        | MeroShareClickPayload
        | MeroShareBlobDownloadPayload
        | MeroShareBlobErrorPayload
        | MeroShareAutoScanItemPayload
        | MeroShareAutoScanDonePayload
        | MeroShareAutoScanErrorPayload
        | MeroShareAutoScanDebugPayload
        | MeroShareFormInspectionPayload
        | MeroShareApiProbePayload
        | MeroShareNetworkLogPayload
        | MeroShareNetworkSnapshotPayload
        | MeroSharePortfolioApiResultPayload
        | MeroShareDirectApiResultPayload
        | MeroShareDirectApiErrorPayload;

      if (payload.type === 'MEROSHARE_CLICK') {
        if (isApiProbingRef.current) {
          return;
        }
        setLastCapture(`MeroShare click: ${String(payload.element.text || payload.element.tag || 'element').slice(0, 60)}`);
        return;
      }

      if (payload.type === 'MEROSHARE_BLOB_DOWNLOAD') {
        void handleBlobDownload(payload);
        return;
      }

      if (payload.type === 'MEROSHARE_BLOB_DOWNLOAD_ERROR') {
        logLarge('Blob download read error', payload);
        setLastCapture(payload.message);
        setDownloadStatus('Could not read browser-generated blob. Check Metro logs.');
        return;
      }

      if (payload.type === 'MEROSHARE_NETWORK_LOG') {
        const sanitizedPayload = sanitizeForLog(payload) as MeroShareNetworkLogPayload;
        setNetworkRecords((current) => {
          const next = [...current, sanitizedPayload].slice(-12);
          const summary = summarizeNetworkRecords(next);
          setApiProbeSummary((existing) => {
            if (existing.status !== 'running') {
              return existing;
            }

            return {
              ...existing,
              message: `Captured ${summary.recordCount} network records while probing`,
              recordCount: summary.recordCount,
              responseCount: summary.responseCount,
              endpoints: summary.endpoints,
              capturedAt: sanitizedPayload.capturedAt,
            };
          });
          return next;
        });
        if (sanitizedPayload.direction === 'response') {
          setDownloadStatus(`Captured response: ${endpointFromRequestUrl(sanitizedPayload.requestUrl)}`);
        }
        return;
      }

      if (payload.type === 'MEROSHARE_NETWORK_SNAPSHOT') {
        const sanitizedRecords = sanitizeForLog(payload.records) as MeroShareNetworkLogPayload[];
        const summary = summarizeNetworkRecords(sanitizedRecords);
        setNetworkRecords(sanitizedRecords.slice(-12));
        setApiProbeSummary({
          status: summary.recordCount ? 'success' : 'empty',
          symbol: apiProbeSummary.symbol,
          message: summary.recordCount
            ? `Snapshot has ${summary.recordCount} MeroShare network records`
            : 'Snapshot is empty. The page may not have made XHR/fetch calls after recorder installation.',
          recordCount: summary.recordCount,
          responseCount: summary.responseCount,
          endpoints: summary.endpoints,
          capturedAt: payload.capturedAt,
        });
        logLarge('MeroShare compact network snapshot', {
          reason: payload.reason,
          pageUrl: payload.pageUrl,
          recordCount: summary.recordCount,
          responseCount: summary.responseCount,
          endpoints: summary.endpoints,
          records: sanitizedRecords,
        });
        setLastCapture(`Network snapshot: ${summary.recordCount} records, ${summary.responseCount} responses`);
        setDownloadStatus(
          summary.endpoints.length
            ? `Endpoints: ${summary.endpoints.join(' | ')}`
            : 'No endpoints captured yet.',
        );
        return;
      }

      if (payload.type === 'MEROSHARE_FORM_INSPECT') {
        setIsCapturing(false);
        logLarge('MeroShare form inspection', payload);
        setLastCapture(
          `Form inspection captured ${payload.elements.length} elements and ${payload.fieldGroups.length} groups`,
        );
        setDownloadStatus('Form DOM is in Metro logs. Search for "MeroShare form inspection".');
        return;
      }

      if (payload.type === 'MEROSHARE_PORTFOLIO_API_RESULT') {
        const account = accountFromMeroShareAccount(payload.account, payload.totalItems);
        const replacedAccountIds = replacedAccountIdsForIncoming(accounts, account);
        const apiHoldings = portfolioApiRowsToHoldings(payload.holdings).map((holding) => ({
          ...holding,
          accountId: account.id,
        }));
        setAccounts((current) => mergeAccountRecords(current, {
          ...account,
          holdings: apiHoldings.length,
        }));
        setActiveAccountId(account.id);
        setSyncedHoldings((current) => [
          ...current.filter((holding) => holding.accountId !== account.id &&
            !recordBelongsToReplacedAccount(holding, replacedAccountIds)),
          ...apiHoldings,
        ]);
        setCostBasisRecords((current) => current.filter((record) => record.accountId !== account.id &&
          !recordBelongsToReplacedAccount(record, replacedAccountIds)));
        setPurchaseLotRecords((current) => current.filter((lot) => lot.accountId !== account.id &&
          !recordBelongsToReplacedAccount(lot, replacedAccountIds)));
        setDirectApiSummary((current) => ({
          ...current,
          status: 'running',
          symbol: `${apiHoldings.length} holdings`,
          message: `Portfolio API imported ${apiHoldings.length}/${payload.totalItems} holdings`,
          dematMasked: payload.account.dematMasked,
          total: apiHoldings.length,
          completed: 0,
        }));
        setAutoScanSummary({
          symbol: `${apiHoldings.length} symbols`,
          status: 'running',
          message: 'Portfolio imported. Syncing WACC costs now.',
          tableCount: 0,
          waccCount: 0,
          lotCount: 0,
          lastStep: 'portfolio-api-imported',
        });
        logLarge('MeroShare portfolio API result summary', {
          dematMasked: payload.account.dematMasked,
          pageCount: payload.pageCount,
          totalItems: payload.totalItems,
          importedHoldings: apiHoldings.length,
          firstSymbols: apiHoldings.slice(0, 12).map((holding) => holding.symbol),
        });
        setLastCapture(`Portfolio API imported ${apiHoldings.length} holdings`);
        setDownloadStatus('Holdings imported. WACC cost sync is running.');
        return;
      }

      if (payload.type === 'MEROSHARE_DIRECT_API_RESULT') {
        const symbol = payload.symbol.trim().toUpperCase();
        const accountId = accountIdFromMeroShareAccount(payload.account);
        const holdingQuantity = payload.holdingQuantity ||
          syncedHoldings.find((holding) => holding.accountId === accountId && holding.symbol === symbol)?.quantity ||
          holdings.find((holding) => holding.accountId === accountId && holding.symbol === symbol)?.quantity ||
          0;
        const pageCostBasis = directWaccToCostBasis(symbol, payload.wacc, holdingQuantity).map((record) => ({
          ...record,
          accountId,
        }));
        const pagePurchaseLots = directWaccToPurchaseLots(symbol, payload.wacc).map((lot) => ({
          ...lot,
          accountId,
        }));
        const fallbackHolding = directWaccToHolding(symbol, payload.wacc, holdingQuantity);
        const scopedFallbackHolding = fallbackHolding
          ? {
              ...fallbackHolding,
              accountId,
            }
          : null;
        const isLoopDone = payload.index >= payload.total;

        if (scopedFallbackHolding) {
          setSyncedHoldings((current) => {
            if (current.some((holding) => holding.accountId === accountId && holding.symbol === scopedFallbackHolding.symbol)) {
              return current;
            }

            return mergeHoldingRecords(current, [scopedFallbackHolding]);
          });
        }
        addCostBasisRecords(pageCostBasis);
        addPurchaseLotRecords(pagePurchaseLots);
        setIsAutoScanning(!isLoopDone);
        setDirectApiSummary({
          status: 'success',
          symbol,
          message:
            payload.total > 1
              ? `Synced ${payload.index}/${payload.total}: ${symbol}`
              : `Direct API succeeded. WACC response: ${payload.responseShape}`,
          dematMasked: payload.account.dematMasked,
          waccStatus: payload.waccStatus,
          responseShape: payload.responseShape,
          itemCount: payload.itemCount,
          total: payload.total,
          completed: payload.index,
          failed: directApiSummary.failed || 0,
          capturedAt: payload.capturedAt,
        });
        setAutoScanSummary((current) => ({
          ...current,
          symbol: payload.total > 1 ? `${payload.index}/${payload.total}: ${symbol}` : symbol,
          status: isLoopDone ? 'success' : 'running',
          message: isLoopDone
            ? `Direct API sync finished. Parsed ${current.waccCount + pageCostBasis.length} WACC records and ${current.lotCount + pagePurchaseLots.length} lots`
            : `Direct API parsed ${symbol}`,
          waccCount: current.waccCount + pageCostBasis.length,
          lotCount: current.lotCount + pagePurchaseLots.length,
          lastStep: isLoopDone ? 'direct-api-loop-done' : 'direct-api-item',
        }));
        logLarge('MeroShare direct API result summary', {
          symbol,
          index: payload.index,
          total: payload.total,
          dematMasked: payload.account.dematMasked,
          ownDetailStatus: payload.ownDetailStatus,
          waccStatus: payload.waccStatus,
          responseShape: payload.responseShape,
          itemCount: payload.itemCount,
          holdingQuantity,
          parsedCostBasis: pageCostBasis.map((record) => {
            const raw = asRecord(record.raw);
            return {
              symbol: record.symbol,
              calculatedQuantity: record.calculatedQuantity,
              averageCost: record.averageCost,
              totalCost: record.totalCost,
              accountId: record.accountId,
              meroShareRowCount: asArray(raw.meroShareRows).length,
              hasMeroShareSummary: Object.keys(asRecord(raw.meroShareWaccSummary)).length > 0,
            };
          }),
          parsedPurchaseLotCount: pagePurchaseLots.length,
          ...(VERBOSE_MEROSHARE_LOGS ? { wacc: sanitizeForLog(payload.wacc) } : {}),
        });
        setLastCapture(
          payload.total > 1
            ? `Direct WACC ${payload.index}/${payload.total}: ${symbol}`
            : `Direct API for ${symbol}: HTTP ${payload.waccStatus}, ${payload.itemCount} item(s)`,
        );
        setDownloadStatus(
          isLoopDone
            ? `Cost sync complete. Demat ${payload.account.dematMasked}`
            : `Cost sync running. Demat ${payload.account.dematMasked}`,
        );
        if (isLoopDone && directSyncModeRef.current !== 'single') {
          setTimeout(() => {
            directSyncModeRef.current = null;
            setIsSyncOpen(false);
          }, 700);
        }
        return;
      }

      if (payload.type === 'MEROSHARE_DIRECT_API_ERROR') {
        const isLoopError = Boolean(payload.index && payload.total && payload.index < payload.total);
        setIsAutoScanning(isLoopError);
        if (!isLoopError) {
          autoSyncStartedRef.current = false;
        }
        setDirectApiSummary({
          status: 'error',
          symbol: payload.symbol,
          message: `${payload.step}: ${payload.message}`,
          dematMasked: '',
          waccStatus: payload.status,
          responseShape: payload.responseText ? payload.responseText.slice(0, 80) : undefined,
          total: payload.total,
          completed: payload.index,
          failed: (directApiSummary.failed || 0) + 1,
          capturedAt: payload.capturedAt,
        });
        setAutoScanSummary((current) => ({
          ...current,
          symbol: payload.symbol,
          status: isLoopError ? 'running' : 'error',
          message: payload.message,
          lastStep: `direct-api-error:${payload.step}`,
        }));
        logLarge('MeroShare direct API error', {
          symbol: payload.symbol,
          step: payload.step,
          status: payload.status,
          message: payload.message,
          responseText: sanitizeForLog(payload.responseText),
        });
        setLastCapture(`Direct API failed on ${payload.step}: ${payload.message}`);
        setDownloadStatus('Direct API failed. The token may not be discoverable from WebView storage yet.');
        return;
      }

      if (payload.type === 'MEROSHARE_API_PROBE') {
        setIsApiProbing(false);
        isApiProbingRef.current = false;
        const records = sanitizeForLog(payload.records) as MeroShareNetworkLogPayload[];
        const summary = summarizeNetworkRecords(records);
        setNetworkRecords(records.slice(-12));
        setApiProbeSummary({
          status: summary.recordCount ? 'success' : 'empty',
          symbol: payload.symbol,
          message: summary.recordCount
            ? `API probe captured ${summary.recordCount} network records`
            : 'API probe completed but captured no XHR/fetch records',
          recordCount: summary.recordCount,
          responseCount: summary.responseCount,
          endpoints: summary.endpoints,
          capturedAt: payload.capturedAt,
        });
        logLarge('MeroShare API probe summary', {
          symbol: payload.symbol,
          recordCount: summary.recordCount,
          responseCount: summary.responseCount,
          endpoints: summary.endpoints,
          records,
        });
        setLastCapture(`API probe for ${payload.symbol}: ${summary.recordCount} records, ${summary.responseCount} responses`);
        setDownloadStatus(
          summary.endpoints.length
            ? `Captured endpoints: ${summary.endpoints.join(' | ')}`
            : 'Probe ran, but no network endpoint was captured.',
        );
        return;
      }

      if (payload.type === 'MEROSHARE_AUTOSCAN_DEBUG') {
        logLarge('Auto WACC debug', payload);
        setAutoScanSummary((current) => ({
          ...current,
          symbol: payload.symbol || current.symbol,
          status: current.status === 'error' ? current.status : 'running',
          message: `Step: ${payload.step}`,
          lastStep: payload.step,
        }));
        setDownloadStatus(`Auto 1 step: ${payload.step}`);
        return;
      }

      if (payload.type === 'MEROSHARE_AUTOSCAN_ITEM') {
        const pageCostBasis = extractCostBasisFromTables(payload.tables);
        const pagePurchaseLots = extractPurchaseLotsFromTables(payload.tables);

        if (!isApiProbingRef.current) {
          logLarge('Auto WACC scan item', {
            symbol: payload.symbol,
            index: payload.index,
            total: payload.total,
            costBasis: pageCostBasis,
            purchaseLots: pagePurchaseLots,
            tableSummaries: payload.tables.map((table) => ({
              index: table.index,
              headers: table.headers,
              rowCount: table.rows.length,
              firstRow: table.rows[0],
            })),
          });
        }

        addCostBasisRecords(pageCostBasis);
        addPurchaseLotRecords(pagePurchaseLots);
        setAutoScanSummary((current) => ({
          symbol: payload.symbol,
          status: pageCostBasis.length || pagePurchaseLots.length ? 'success' : 'done',
          message:
            pageCostBasis.length || pagePurchaseLots.length
              ? `Parsed ${payload.symbol} (${payload.index}/${payload.total})`
              : `No WACC/source rows parsed for ${payload.symbol}`,
          tableCount: current.tableCount + payload.tables.length,
          waccCount: current.waccCount + pageCostBasis.length,
          lotCount: current.lotCount + pagePurchaseLots.length,
          lastStep: 'parsed-result',
        }));
        setLastCapture(
          `Auto WACC ${payload.index}/${payload.total}: ${payload.symbol} (${pageCostBasis.length} WACC records, ${pagePurchaseLots.length} lots)`,
        );
        setDownloadStatus('Automated WACC scan is running. Keep this screen open.');
        return;
      }

      if (payload.type === 'MEROSHARE_AUTOSCAN_DONE') {
        logLarge('Auto WACC scan completed', payload);
        setIsAutoScanning(false);
        setIsApiProbing(false);
        isApiProbingRef.current = false;
        setAutoScanSummary((current) => {
          if (current.status === 'error') {
            return current;
          }

          if (!current.tableCount && !current.waccCount && !current.lotCount) {
            return {
              ...current,
              status: 'done',
              message: 'Scan finished, but no parsed item came back',
              lastStep: 'done',
            };
          }

          return {
            ...current,
            status: current.status === 'success' ? 'success' : 'done',
          message: `Scan finished. Parsed ${current.waccCount} WACC records and ${current.lotCount} lots`,
          lastStep: 'done',
        };
      });
        setLastCapture(`Auto WACC scan completed for ${payload.total} symbols`);
        setDownloadStatus('WACC records found during the scan have been merged into holdings.');
        return;
      }

      if (payload.type === 'MEROSHARE_AUTOSCAN_ERROR') {
        logLarge('Auto WACC scan error', payload);
        if (!payload.symbol) {
          setIsAutoScanning(false);
        }
        if (isApiProbingRef.current) {
          setApiProbeSummary((current) => ({
            ...current,
            status: current.recordCount ? 'success' : 'error',
            symbol: payload.symbol || current.symbol,
            message: payload.message,
            capturedAt: payload.capturedAt,
          }));
        }
        setIsApiProbing(false);
        isApiProbingRef.current = false;
        setAutoScanSummary((current) => ({
          symbol: payload.symbol || current.symbol || 'unknown',
          status: 'error',
          message: payload.message,
          tableCount: current.tableCount,
          waccCount: current.waccCount,
          lotCount: current.lotCount,
          lastStep: payload.index ? `symbol ${payload.index}/${payload.total || '?'}` : 'error',
        }));
        setLastCapture(
          payload.symbol
            ? `Auto WACC issue on ${payload.symbol}: ${payload.message}`
            : payload.message,
        );
        setDownloadStatus('Auto WACC scan hit an issue. Check Metro logs for details.');
        return;
      }

      if (payload.type !== 'MEROSHARE_EXTRACT') {
        logLarge('Unknown WebView message', payload);
        return;
      }

      setIsCapturing(false);
      const normalizedHoldings = payload.candidateHoldings
        .map(normalizeHolding)
        .filter((holding): holding is Holding => Boolean(holding));
      const pageCostBasis = extractCostBasisFromTables(payload.tables);
      const pagePurchaseLots = extractPurchaseLotsFromTables(payload.tables);
      const isPortfolioPage = tablesContainPortfolioHoldings(payload.tables);

      logLarge('Raw page extraction', payload);
      logLarge('Visible MeroShare buttons and links', payload.interactiveElements || []);
      logLarge('MeroShare source discovery signals', {
        url: payload.url,
        title: payload.title,
        keywordSnippets: payload.keywordSnippets || [],
        tableSummaries: payload.tables.map((table) => ({
          index: table.index,
          headers: table.headers,
          rowCount: table.rows.length,
          firstRow: table.rows[0],
        })),
        likelyUsefulControls: (payload.interactiveElements || []).filter((element) => {
          const text = String(element.text || '').toLowerCase();
          const href = String(element.href || '').toLowerCase();
          return [
            'wacc',
            'purchase',
            'source',
            'portfolio',
            'holding',
            'transaction',
            'capital',
            'download',
            'csv',
            'report',
          ].some((keyword) => text.includes(keyword) || href.includes(keyword));
        }),
      });
      logLarge('Normalized holdings', normalizedHoldings);
      logLarge('Page cost basis records', pageCostBasis);
      logLarge('Page purchase lots', pagePurchaseLots);

      setLastCapture(
        `${normalizedHoldings.length} holding candidates, ${pageCostBasis.length} WACC records from ${payload.tables.length} tables`,
      );

      addCostBasisRecords(pageCostBasis);
      addPurchaseLotRecords(pagePurchaseLots);

      if (normalizedHoldings.length > 0 && isPortfolioPage) {
        setSyncedHoldings(normalizedHoldings);
      }
    } catch (error) {
      setIsCapturing(false);
      console.log('[MeroShare Sync] Failed to parse WebView message');
      console.log(error);
      console.log(event.nativeEvent.data);
      setLastCapture('Capture failed. Check Metro terminal logs.');
    }
  }

  function handleNepseWebViewMessage(event: WebViewMessageEvent) {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (!nepseWebViewPromiseRef.current) {
        return;
      }

      if (payload.type === 'nepse_price_result') {
        const quoteMap = new Map<string, PriceQuote>();
        const rawQuotes = payload.quotes as Record<string, { ltp: number; dayChangePercent: number | null }>;
        Object.entries(rawQuotes).forEach(([symbol, entry]) => {
          const ltp = Number(entry?.ltp ?? entry);
          if (symbol && ltp > 0) {
            const dayChangePercent = entry?.dayChangePercent != null ? Number(entry.dayChangePercent) : undefined;
            quoteMap.set(symbol, { symbol, ltp, dayChangePercent, raw: {} });
          }
        });
        nepseWebViewPromiseRef.current.resolve({
          endpoint: `NEPSE today-price ${payload.businessDate || ''} (WebView)`,
          quotes: quoteMap,
          nepseIndexData: payload.nepseIndexData || null,
        });
      } else if (payload.type === 'nepse_price_error') {
        nepseWebViewPromiseRef.current.reject(new Error(payload.error || 'NEPSE WebView fetch failed'));
      }
    } catch (_) {
      // ignore non-NEPSE messages from the background WebView
    }
  }

  function renderHoldingCard(holding: Holding, onPress?: () => void) {
    const cost = holding.quantity * holding.averageCost;
    const value = holding.quantity * holding.ltp;
    const holdingPnl = value - cost;
    const holdingPnlPercent = cost > 0 ? (holdingPnl / cost) * 100 : 0;
    const holdingIsProfit = holdingPnl >= 0;

    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress || (() => setSelectedSymbol(holding.symbol))}
        style={styles.holdingCard}
      >
        <View style={styles.holdingRowTop}>
          <Text style={styles.holdingMetaText}>
            Qty. {holding.quantity} <Text style={styles.holdingDot}>•</Text> Avg. {formatDecimal(holding.averageCost)}
          </Text>
          <Text style={[styles.holdingPnlPercent, holdingIsProfit ? styles.profitText : styles.lossText]}>
            {holdingIsProfit ? '+' : ''}
            {formatDecimal(holdingPnlPercent)}%
          </Text>
        </View>

        <View style={styles.holdingRowMiddle}>
          <Text style={styles.holdingSymbolText}>{holding.symbol}</Text>
          <Text style={[styles.holdingPnlValue, holdingIsProfit ? styles.profitText : styles.lossText]}>
            {holdingIsProfit ? '+' : ''}
            {formatMoney(holdingPnl)}
          </Text>
        </View>

        <View style={styles.holdingRowBottom}>
          <Text style={styles.holdingMetaText}>Invested {formatMoney(cost).replace('Rs. ', '')}</Text>
          <Text style={styles.holdingMetaText}>
            {'LTP '}
            {formatDecimal(holding.ltp)}
            {holding.dayChangePercent != null ? (
              <Text style={holding.dayChangePercent >= 0 ? styles.profitText : styles.lossText}>
                {' ('}
                {holding.dayChangePercent >= 0 ? '+' : ''}
                {formatDecimal(holding.dayChangePercent)}
                {'%)'}
              </Text>
            ) : null}
          </Text>
        </View>
      </Pressable>
    );
  }

  async function refreshLatestPrices(symbols: string[]) {
    const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean))).sort();

    if (!uniqueSymbols.length) {
      setPriceStatus('No holdings available for price refresh.');
      return;
    }

    if (isPriceRefreshing) {
      return;
    }

    setIsPriceRefreshing(true);
    setPriceStatus('Updating latest NEPSE prices...');

    try {
      // Show the WebView overlay — it loads nepalstock.com with real Chrome TLS,
      // bypassing the WAF fingerprint check that blocks native fetch.
      const { endpoint, quotes, nepseIndexData: indexData } = await new Promise<{
        endpoint: string;
        quotes: Map<string, PriceQuote>;
        nepseIndexData: NepseIndexData | null;
      }>((resolve, reject) => {
        if (nepseWebViewPromiseRef.current) {
          nepseWebViewPromiseRef.current.reject(new Error('Superseded by new price refresh'));
        }
        const timer = setTimeout(() => {
          nepseWebViewPromiseRef.current = null;
          setIsPriceFetchWebViewOpen(false);
          reject(new Error('NEPSE price fetch timed out'));
        }, 35000);
        nepseWebViewPromiseRef.current = {
          resolve: (r) => { clearTimeout(timer); nepseWebViewPromiseRef.current = null; resolve(r); },
          reject: (e) => { clearTimeout(timer); nepseWebViewPromiseRef.current = null; reject(e); },
        };
        nepseWebViewSymbolsRef.current = uniqueSymbols;
        setIsPriceFetchWebViewOpen(true);
      });

      const updatedAt = new Date().toISOString();
      const missingSymbols = uniqueSymbols.filter((symbol) => !quotes.has(symbol));
      setSyncedHoldings((current) => mergeLatestPricesIntoHoldings(current, quotes, updatedAt));
      setPriceSyncedAt(updatedAt);
      if (indexData) {
        setNepseIndexData(indexData);
      }
      if (missingSymbols.length) {
        logLarge('NEPSE latest price missing symbols', {
          endpoint,
          requested: uniqueSymbols.length,
          returned: quotes.size,
          missingSymbols,
        });
      }
      setPriceStatus(
        missingSymbols.length
          ? `Updated ${quotes.size}/${uniqueSymbols.length} prices from ${endpoint}; missing ${missingSymbols.join(', ')}`
          : `Updated ${quotes.size}/${uniqueSymbols.length} prices from ${endpoint}`,
      );
    } catch (error) {
      console.log('[NEPSE price fetch] Failed', error);
      setPriceStatus('Latest price fetch unavailable; using cached MeroShare prices.');
    } finally {
      setIsPriceRefreshing(false);
      setIsPriceFetchWebViewOpen(false);
    }
  }

  async function handleExportCSV(holdingsToExport: Holding[], forAccountId?: string | null) {
    if (isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      const lotsToExport = forAccountId
        ? purchaseLotRecords.filter((lot) => lot.accountId === forAccountId)
        : purchaseLotRecords;
      const costBasisToExport = forAccountId
        ? costBasisRecords.filter((r) => r.accountId === forAccountId)
        : costBasisRecords;
      const csv = buildHoldingsCSV(holdingsToExport, lotsToExport, costBasisToExport, accounts, !forAccountId);
      const date = new Date().toISOString().slice(0, 10);
      const safeName = forAccountId
        ? (accounts.find((a) => a.id === forAccountId)?.name || forAccountId)
          .replace(/\s+/g, '-')
          .replace(/[^a-zA-Z0-9-]/g, '')
          .slice(0, 30)
        : 'All-Accounts';
      await shareHoldingsCSV(`NEPSE-${safeName}-${date}.csv`, csv);
    } catch {
      // share sheet dismissed or failed silently
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportPL(holdingsToExport: Holding[], forAccountId?: string | null) {
    if (isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      const csv = buildPLSummaryCSV(holdingsToExport, accounts, !forAccountId);
      const date = new Date().toISOString().slice(0, 10);
      const safeName = forAccountId
        ? (accounts.find((a) => a.id === forAccountId)?.name || forAccountId)
          .replace(/\s+/g, '-')
          .replace(/[^a-zA-Z0-9-]/g, '')
          .slice(0, 30)
        : 'All-Accounts';
      await shareHoldingsCSV(`NEPSE-PL-${safeName}-${date}.csv`, csv);
    } catch {
      // share sheet dismissed or failed silently
    } finally {
      setIsExporting(false);
    }
  }

  function renderExportButton(
    scope: 'home' | 'account',
    onCSV: () => void,
    onPL: () => void,
  ) {
    const ref = scope === 'home' ? exportButtonHomeRef : exportButtonAccountRef;

    return (
      <View ref={ref} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export portfolio data"
          disabled={isExporting}
          onPress={() => {
            exportOnCSVRef.current = onCSV;
            exportOnPLRef.current = onPL;
            ref.current?.measure((_x, _y, _w, h, _px, py) => {
              setExportMenuTop(py + h + 6);
              setExportMenuVisible(true);
            });
          }}
          style={({ pressed }) => [
            styles.priceRefreshButton,
            (exportMenuVisible || isExporting) && styles.pressedButton,
            isExporting && styles.disabledButton,
          ]}
        >
          <Text style={styles.priceRefreshButtonText}>
            {isExporting ? '…' : '📤'}
          </Text>
        </Pressable>
      </View>
    );
  }

  function renderExportModal() {
    return (
      <Modal
        transparent
        animationType="fade"
        visible={exportMenuVisible}
        onRequestClose={() => setExportMenuVisible(false)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setExportMenuVisible(false)}
          />
          <View style={[styles.exportMenuPopover, { top: exportMenuTop }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setExportMenuVisible(false);
                exportOnCSVRef.current?.();
              }}
              style={({ pressed }) => [styles.sortMenuItem, pressed && styles.sortMenuItemActive]}
            >
              <Text style={styles.sortMenuItemText}>Sources & WACC data</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setExportMenuVisible(false);
                exportOnPLRef.current?.();
              }}
              style={({ pressed }) => [styles.sortMenuItem, pressed && styles.sortMenuItemActive]}
            >
              <Text style={styles.sortMenuItemText}>P&L summary</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  function renderPriceRefreshButton(symbols: string[]) {
    const isDisabled = isPriceRefreshing || symbols.length === 0;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Refresh prices"
        disabled={isDisabled}
        onPress={() => refreshLatestPrices(symbols)}
        style={({ pressed }) => [
          styles.priceRefreshButton,
          pressed && !isDisabled && styles.pressedButton,
          isDisabled && styles.disabledButton,
        ]}
      >
        <Text style={styles.priceRefreshButtonText}>
          {isPriceRefreshing ? '...' : '↻'}
        </Text>
      </Pressable>
    );
  }

  function renderShareSearchLauncher(value: string, onPress: () => void) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search shares"
        onPress={onPress}
        style={styles.shareSearchInput}
      >
        <Text style={value ? styles.shareSearchValue : styles.shareSearchPlaceholder}>
          {value || 'Search by symbol or company'}
        </Text>
      </Pressable>
    );
  }

  function sortOptionLabel(sortOption: SortOption) {
    switch (sortOption) {
      case 'alphabetical':
        return 'A–Z';
      case 'profit-value':
        return 'Profit Rs.';
      case 'profit-pct':
        return 'Profit %';
      case 'loss-value':
        return 'Loss Rs.';
      case 'loss-pct':
        return 'Loss %';
      case 'invested':
        return 'Invested';
      case 'value':
        return 'Value';
      default:
        return 'A–Z';
    }
  }

  function renderShareListControls({
    searchValue,
    onSearchPress,
    sortOption,
    onSortChange,
    scope,
  }: {
    searchValue: string;
    onSearchPress: () => void;
    sortOption: SortOption;
    onSortChange: (sortOption: SortOption) => void;
    scope: 'home' | 'account';
  }) {
    const isSortOpen = openSortScope === scope;
    const sortOptions: Array<{ value: SortOption; label: string }> = [
      { value: 'alphabetical', label: 'Sort A–Z' },
      { value: 'profit-value', label: 'Sort by profit (Rs.)' },
      { value: 'profit-pct', label: 'Sort by profit (%)' },
      { value: 'loss-value', label: 'Sort by loss (Rs.)' },
      { value: 'loss-pct', label: 'Sort by loss (%)' },
      { value: 'invested', label: 'Sort by invested' },
      { value: 'value', label: 'Sort by current value' },
    ];

    return (
      <View style={styles.shareListControls}>
        <View style={styles.shareSearchSortRow}>
          <View style={styles.shareSearchWrap}>
            {renderShareSearchLauncher(searchValue, onSearchPress)}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort: ${sortOptionLabel(sortOption)}`}
            onPress={() => setOpenSortScope(isSortOpen ? null : scope)}
            style={[styles.sortButton, sortOption !== 'alphabetical' && styles.sortButtonActive]}
          >
            <Text style={styles.sortButtonText}>⇅</Text>
          </Pressable>
        </View>
        {isSortOpen ? (
          <View style={styles.sortMenu}>
            {sortOptions.map((option) => {
              const isSelected = option.value === sortOption;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  onPress={() => {
                    onSortChange(option.value);
                    setOpenSortScope(null);
                  }}
                  style={[styles.sortMenuItem, isSelected && styles.sortMenuItemActive]}
                >
                  <Text style={[styles.sortMenuItemText, isSelected && styles.sortMenuItemTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }

  function renderPortfolioSummaryPanel({
    currentValue,
    totalInvested,
    totalProfitLoss,
    totalProfitLossPercent,
    totalHoldings,
    totalShares,
    statusText,
    accountCount,
  }: {
    currentValue: number;
    totalInvested: number;
    totalProfitLoss: number;
    totalProfitLossPercent: number;
    totalHoldings: number;
    totalShares: number;
    statusText?: string;
    accountCount?: number;
  }) {
    const summaryIsProfit = totalProfitLoss >= 0;
    const labelText = accountCount
      ? `Current value · ${accountCount} ${accountCount === 1 ? 'account' : 'accounts'}`
      : 'Current value';

    return (
      <View style={styles.summaryPanel}>
        <Text style={styles.panelLabel}>{labelText}</Text>
        <View style={styles.summaryTopRow}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.valueText}>
            {formatMoney(currentValue)}
          </Text>
          <View style={[styles.pnlPill, summaryIsProfit ? styles.profitPill : styles.lossPill]}>
            <Text style={[styles.pnlText, summaryIsProfit ? styles.profitText : styles.lossText]}>
              {summaryIsProfit ? '+' : ''}
              {formatDecimal(totalProfitLossPercent)}%
            </Text>
          </View>
        </View>

        <View style={styles.summaryMetrics}>
          <View style={styles.summaryMetricRow}>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Total holdings</Text>
              <Text style={styles.metricValue}>{totalHoldings}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Total qty</Text>
              <Text style={styles.metricValue}>{formatDecimal(totalShares)}</Text>
            </View>
          </View>

          <View style={styles.summaryRowDivider} />

          <View style={styles.summaryMetricRow}>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Total invested</Text>
              <Text style={styles.metricValue}>{formatMoney(totalInvested)}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Total P/L</Text>
              <Text style={[styles.metricValue, summaryIsProfit ? styles.profitText : styles.lossText]}>
                {summaryIsProfit ? '+' : ''}
                {formatMoney(totalProfitLoss)}
              </Text>
            </View>
          </View>
        </View>

        {statusText ? (
          <Text style={styles.priceStatusText}>{statusText}</Text>
        ) : null}
      </View>
    );
  }

  if (activeSearchScope) {
    const isAccountSearch = activeSearchScope === 'account';
    const searchValue = isAccountSearch ? accountSearchQuery : consolidatedSearchQuery;
    const setSearchValue = isAccountSearch ? setAccountSearchQuery : setConsolidatedSearchQuery;
    const searchResults = isAccountSearch ? filteredAccountHoldings : filteredConsolidatedHoldings;

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.searchScreenContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close search"
            hitSlop={12}
            onPress={() => setActiveSearchScope(null)}
            style={({ pressed }) => [
              styles.detailBackButton,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.detailBackText}>←</Text>
          </Pressable>

          <TextInput
            accessibilityLabel="Search shares"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            clearButtonMode="while-editing"
            onChangeText={setSearchValue}
            placeholder="Search by symbol or company"
            placeholderTextColor="#8a8d9a"
            returnKeyType="search"
            style={[styles.shareSearchInput, { marginBottom: 12 }]}
            value={searchValue}
          />

          <FlatList
            data={searchResults}
            keyExtractor={(holding) => `${holding.accountId || 'consolidated'}-${holding.symbol}-${holding.quantity}`}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
            ListEmptyComponent={(
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>
                  {searchValue.trim() ? 'No matching shares' : 'Search shares'}
                </Text>
                <Text style={styles.emptyStateText}>
                  {searchValue.trim()
                    ? 'Try searching by another symbol or company name.'
                    : 'Type a stock symbol or company name to filter this list.'}
                </Text>
              </View>
            )}
            renderItem={({ item }) => renderHoldingCard(item, () => {
              setActiveSearchScope(null);
              setSelectedSymbol(item.symbol);
            })}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isPriceFetchWebViewOpen) {
    return (
      <SafeAreaView style={styles.syncScreen}>
        <StatusBar style="light" />
        <View style={styles.webViewWrap}>
          {/* FlipkartRootCA (NEPSE's private CA) is trusted via network_security_config.xml */}
          <WebView
            ref={nepseWebViewRef}
            source={{ uri: 'https://www.nepalstock.com/' }}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            onLoadEnd={() => {
              nepseWebViewRef.current?.injectJavaScript(
                createNepseFetchScript(nepseWebViewSymbolsRef.current),
              );
            }}
            onMessage={handleNepseWebViewMessage}
          />
          <View style={styles.syncLoaderOverlay}>
            <ActivityIndicator color="#8fd5bf" size="large" />
            <Text style={styles.syncLoaderTitle}>Fetching live prices…</Text>
            <Text style={styles.syncLoaderText}>Loading NEPSE data</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (isSyncOpen) {
    return (
      <SafeAreaView style={styles.syncScreen}>
        <StatusBar style="light" />
        <View style={styles.webViewWrap}>
          {isWebViewLoading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#1f7a5a" />
            </View>
          ) : null}
          <WebView
            ref={webViewRef}
            source={{ uri: MEROSHARE_URL }}
            javaScriptEnabled
            domStorageEnabled
            injectedJavaScriptBeforeContentLoaded={MEROSHARE_NETWORK_LOGGER_SCRIPT}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            onLoadStart={() => setIsWebViewLoading(true)}
            onLoadEnd={() => {
              setIsWebViewLoading(false);
              webViewRef.current?.injectJavaScript(MEROSHARE_NETWORK_LOGGER_SCRIPT);
              maybeStartAutoSync(currentUrl);
            }}
            onNavigationStateChange={(navState) => {
              setCurrentUrl(navState.url);
              console.log(`[MeroShare Sync] Navigated to ${navState.url}`);
              maybeStartAutoSync(navState.url);
            }}
            onShouldStartLoadWithRequest={(request) => {
              console.log(`[MeroShare Sync] Should start load: ${request.url}`);
              return true;
            }}
            onOpenWindow={(event) => {
              console.log(`[MeroShare Sync] Open window requested: ${event.nativeEvent.targetUrl}`);
            }}
            onError={(event) => {
              logLarge('WebView load error', event.nativeEvent);
            }}
            onHttpError={(event) => {
              logLarge('WebView HTTP error', event.nativeEvent);
            }}
            onFileDownload={handleFileDownload}
            onMessage={handleWebViewMessage}
          />
          {isAutoScanning ? (
            <View style={styles.syncLoaderOverlay}>
              <ActivityIndicator color="#8fd5bf" size="large" />
              <Text style={styles.syncLoaderTitle}>
                {autoScanSummary.lastStep === 'portfolio-api-start'
                  ? 'Pulling your holdings'
                  : 'Pulling your cost basis'}
              </Text>
              <Text style={styles.syncLoaderText}>
                {directApiSummary.completed && directApiSummary.total
                  ? `${directApiSummary.completed}/${directApiSummary.total} symbols`
                  : 'Preparing symbols'}
              </Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (selectedHolding) {
    const isConsolidatedShareDetail = !selectedAccountDetailId;
    const costBasisRaw = selectedCostBasis?.raw || asRecord(asRecord(selectedHolding.raw).costBasis);
    const displayedAverageCost = selectedCostBasis?.averageCost || selectedHolding.averageCost;
    const currentHoldingQuantity = selectedHolding.quantity;
    const currentMarketValue = currentHoldingQuantity * selectedHolding.ltp;
    const dashboardCostBasis = currentHoldingQuantity * displayedAverageCost;
    const detailProfitLoss = currentMarketValue - dashboardCostBasis;
    const detailProfitLossPercent = dashboardCostBasis > 0 ? (detailProfitLoss / dashboardCostBasis) * 100 : 0;
    const detailIsProfit = detailProfitLoss >= 0;
    const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));
    const purchaseSourceTableRows: Array<Record<string, unknown>> = selectedPurchaseLots.map((lot) => ({
      ...(isConsolidatedShareDetail
        ? { account: accountNameById.get(lot.accountId || 'default') || lot.accountId || 'Saved account' }
        : {}),
      source: lot.purchaseSource || 'Unknown',
      date: lot.transactionDate || '-',
      qty: formatDecimal(lot.quantity),
      rate: `Rs. ${formatDecimal(lot.rate)}`,
      cashPriceUsed: `Rs. ${formatDecimal(lot.purchasePrice)}`,
      cashCost: formatMoney(lot.totalCost),
      ...(lot.remarks ? { remarks: lot.remarks } : {}),
    }));
    const purchaseSourceTableColumns = tableColumns(purchaseSourceTableRows);
    const waccSummaryTableRows: Array<Record<string, unknown>> = selectedShareAccountBreakdowns.flatMap((breakdown) => {
      const accountId = breakdown.holding.accountId || 'default';
      const record = recordsForAccount(costBasisRecords, accountId)
        .find((item) => item.symbol === selectedHolding.symbol);
      const summary = asRecord(asRecord(record?.raw).meroShareWaccSummary);
      const hasSummary = Object.entries(summary)
        .some(([, value]) => value !== undefined && value !== null && tableCellText(value) !== '');

      if (!hasSummary) {
        return [];
      }

      return [{
        ...(isConsolidatedShareDetail ? { account: breakdown.account.name } : {}),
        ...summary,
      }];
    });
    const waccSummaryTableColumns = tableColumns(waccSummaryTableRows);
    const detailWarnings = selectedShareAccountBreakdowns.flatMap((breakdown) => [
      breakdown.coverage?.hasNoPurchaseSourceData
        ? {
          title: isConsolidatedShareDetail
            ? `${breakdown.account.name}: no purchase source data`
            : 'No purchase source data',
          message: 'No purchase source table and no WACC summary were stored for this share.',
        }
        : null,
      breakdown.coverage?.hasQuantityMismatch
        ? {
          title: isConsolidatedShareDetail
            ? `${breakdown.account.name}: quantity coverage mismatch`
            : 'Quantity coverage mismatch',
          message: breakdown.coverage.excessRowQuantity > 0
            ? `${formatDecimal(breakdown.coverage.holdingQuantity)} held, ${formatDecimal(breakdown.coverage.rowQuantity)} purchase-source rows, extra rows ${formatDecimal(breakdown.coverage.excessRowQuantity)}.`
            : `${formatDecimal(breakdown.coverage.holdingQuantity)} held, ${formatDecimal(breakdown.coverage.rowQuantity)} purchase-source rows, ${formatDecimal(breakdown.coverage.summaryQuantity)} WACC summary, uncovered ${formatDecimal(breakdown.coverage.uncoveredQuantity)}.`,
        }
        : null,
    ]).filter((warning): warning is { title: string; message: string } => Boolean(warning));

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={styles.detailContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to holdings"
            hitSlop={12}
            onPress={() => setSelectedSymbol(null)}
            style={({ pressed }) => [
              styles.detailBackButton,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.detailBackText}>←</Text>
          </Pressable>

          <View style={styles.detailHero}>
            <Text style={styles.detailSymbol}>{selectedHolding.symbol}</Text>
            <Text style={styles.detailCompany}>{selectedHolding.company}</Text>
          </View>

          <View style={styles.detailSection}>
            <View style={styles.detailPerformanceTop}>
              <Text style={styles.detailPerformanceMeta}>
                Qty. {formatDecimal(currentHoldingQuantity)} <Text style={styles.holdingDot}>•</Text> Avg. {formatDecimal(displayedAverageCost)}
              </Text>
              <Text style={[
                styles.detailPerformancePercent,
                detailIsProfit ? styles.profitText : styles.lossText,
              ]}>
                {detailIsProfit ? '+' : ''}
                {formatDecimal(detailProfitLossPercent)}%
              </Text>
            </View>

            <View style={styles.detailPerformanceMain}>
              <View>
                <Text style={styles.detailPerformanceLabel}>Invested</Text>
                <Text style={styles.detailPerformanceValue}>{formatMoney(dashboardCostBasis)}</Text>
              </View>
              <View style={styles.detailPerformanceRight}>
                <Text style={styles.detailPerformanceLabel}>P/L</Text>
                <Text style={[
                  styles.detailPerformancePnl,
                  detailIsProfit ? styles.profitText : styles.lossText,
                ]}>
                  {detailIsProfit ? '+' : ''}
                  {formatMoney(detailProfitLoss)}
                </Text>
              </View>
            </View>

            <View style={styles.detailPerformanceBottom}>
              <Text style={styles.detailPerformanceMeta}>Value {formatMoney(currentMarketValue)}</Text>
              <Text style={styles.detailPerformanceMeta}>LTP {formatDecimal(selectedHolding.ltp)}</Text>
            </View>
          </View>

          {isConsolidatedShareDetail ? (
            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeaderRow}>
                <Text style={styles.detailSectionTitle}>Demat accounts</Text>
                <Text style={styles.detailSectionMeta}>
                  {selectedShareAccountBreakdowns.length} {selectedShareAccountBreakdowns.length === 1 ? 'account' : 'accounts'}
                </Text>
              </View>
              <Text style={styles.detailNote}>
                {selectedShareAccountBreakdowns.length} demat {selectedShareAccountBreakdowns.length === 1 ? 'account contains' : 'accounts contain'} {selectedHolding.symbol}.
              </Text>
              {selectedShareAccountBreakdowns.map((breakdown) => {
                const breakdownIsProfit = breakdown.profitLoss >= 0;

                return (
                  <View key={`${breakdown.account.id}-${selectedHolding.symbol}`} style={styles.detailAccountShareCard}>
                    <View style={styles.detailAccountShareHeader}>
                      <View style={styles.detailAccountShareNameWrap}>
                        <Text style={styles.detailAccountShareName}>{breakdown.account.name}</Text>
                        <Text style={styles.detailAccountShareDemat}>{breakdown.account.dematMasked}</Text>
                      </View>
                      <Text style={[
                        styles.detailAccountSharePnl,
                        breakdownIsProfit ? styles.profitText : styles.lossText,
                      ]}>
                        {breakdownIsProfit ? '+' : ''}
                        {formatMoney(breakdown.profitLoss)}
                      </Text>
                    </View>
                    <View style={styles.detailAccountShareMetrics}>
                      <Text style={styles.detailAccountShareMeta}>
                        Qty. {formatDecimal(breakdown.holding.quantity)} <Text style={styles.holdingDot}>•</Text> Avg. {formatDecimal(breakdown.holding.averageCost)}
                      </Text>
                      <Text style={styles.detailAccountShareMeta}>Value {formatMoney(breakdown.value)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {detailWarnings.length ? (
            <View style={styles.detailWarningSection}>
              <Text style={styles.detailSectionTitle}>Warnings</Text>
              {detailWarnings.map((warning) => (
                <View key={warning.title} style={styles.detailWarningItem}>
                  <Text style={styles.detailWarningTitle}>{warning.title}</Text>
                  <Text style={styles.detailWarningText}>{warning.message}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>
              {isConsolidatedShareDetail ? 'MeroShare purchase rows across accounts' : 'MeroShare purchase rows'}
            </Text>
            {purchaseSourceTableRows.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View style={styles.wideTable}>
                  <View style={styles.tableRow}>
                    {purchaseSourceTableColumns.map((column) => (
                      <Text key={column} style={[styles.wideTableCell, styles.tableHeaderCell]}>
                        {tableKeyLabel(column)}
                      </Text>
                    ))}
                  </View>
                  {purchaseSourceTableRows.map((row, rowIndex) => (
                    <View key={`${selectedHolding.symbol}-purchase-source-${rowIndex}`} style={styles.tableRow}>
                      {purchaseSourceTableColumns.map((column) => (
                        <Text key={column} style={styles.wideTableCell}>
                          {tableCellText(row[column as keyof typeof row])}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.emptyStateText}>
                {isConsolidatedShareDetail
                  ? 'No usable purchase rows were stored for this share in any synced demat account.'
                  : 'No usable purchase rows were stored for this share. The WACC summary is shown below if available.'}
              </Text>
            )}

            {waccSummaryTableRows.length ? (
              <View style={styles.meroShareTableBlock}>
                <Text style={styles.tableTitle}>WACC summary</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View style={styles.wideTable}>
                    <View style={styles.tableRow}>
                      {waccSummaryTableColumns.map((column) => (
                        <Text key={column} style={[styles.wideTableCell, styles.tableHeaderCell]}>
                          {tableKeyLabel(column)}
                        </Text>
                      ))}
                    </View>
                    {waccSummaryTableRows.map((row, rowIndex) => (
                      <View key={`${selectedHolding.symbol}-wacc-summary-${rowIndex}`} style={styles.tableRow}>
                        {waccSummaryTableColumns.map((column) => (
                          <Text key={column} style={styles.wideTableCell}>
                            {tableCellText(row[column])}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (selectedAccountDetail) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
        <FlatList
          data={filteredAccountHoldings}
          keyExtractor={(holding) => `${holding.accountId || 'default'}-${holding.symbol}-${holding.quantity}`}
          contentContainerStyle={styles.detailContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          removeClippedSubviews
          updateCellsBatchingPeriod={50}
          windowSize={5}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          ListHeaderComponent={(
            <>
              <View>
                <View style={styles.detailTopRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to demat accounts"
                    hitSlop={12}
                    onPress={() => setSelectedAccountDetailId(null)}
                    style={({ pressed }) => [
                      styles.detailBackButton,
                      pressed && styles.pressedButton,
                    ]}
                  >
                    <Text style={styles.detailBackText}>←</Text>
                  </Pressable>
                  <View style={styles.sectionHeaderActions}>
                    {renderPriceRefreshButton(portfolioSymbols)}
                    {renderExportButton(
                      'account',
                      () => handleExportCSV(accountHoldings, selectedAccountDetailId),
                      () => handleExportPL(accountHoldings, selectedAccountDetailId),
                    )}
                  </View>
                </View>
                {renderExportModal()}

                <View style={styles.detailHero}>
                  <Text style={styles.detailSymbol}>{selectedAccountDetail.name}</Text>
                  <Text style={styles.detailCompany}>{selectedAccountDetail.dematMasked}</Text>
                </View>

                {renderPortfolioSummaryPanel({
                  currentValue: accountTotals.value,
                  totalInvested: accountTotals.cost,
                  totalProfitLoss: accountProfitLoss,
                  totalProfitLossPercent: accountProfitLossPercent,
                  totalHoldings: accountHoldings.length,
                  totalShares: accountTotalQuantity,
                  statusText: priceSyncedAt && !priceStatus.includes('unavailable')
                    ? `${priceStatus} at ${new Date(priceSyncedAt).toLocaleTimeString()}`
                    : priceStatus,
                })}

                {accountWarnings.length ? (
                  <View style={styles.detailWarningSection}>
                    <Text style={styles.detailSectionTitle}>Warnings</Text>
                    {accountWarnings.map((warning) => (
                      <View key={warning.title} style={styles.detailWarningItem}>
                        <Text style={styles.detailWarningTitle}>{warning.title}</Text>
                        <Text style={styles.detailWarningText}>{warning.message}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Shares</Text>
                </View>
                {renderShareListControls({
                  searchValue: accountSearchQuery,
                  onSearchPress: () => setActiveSearchScope('account'),
                  sortOption: accountSortOption,
                  onSortChange: setAccountSortOption,
                  scope: 'account',
                })}
              </View>
            </>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>
                {accountSearchQuery.trim() ? 'No matching shares' : 'No shares in this account'}
              </Text>
              <Text style={styles.emptyStateText}>
                {accountSearchQuery.trim()
                  ? 'Try searching by another symbol or company name.'
                  : 'Sync this demat account again if MeroShare has holdings that are not shown here.'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => renderHoldingCard(item)}
        />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
      <FlatList
        data={filteredConsolidatedHoldings}
        keyExtractor={(holding) => holding.symbol}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
        windowSize={5}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        ListHeaderComponent={(
          <>
            <View>
              <View style={styles.header}>
                <View style={styles.headerTitleBlock}>
                  <Text style={styles.title}>Lagani</Text>
                </View>
                <View style={styles.sectionHeaderActions}>
                  {renderPriceRefreshButton(priceRefreshSymbols)}
                  {renderExportButton(
                    'home',
                    () => handleExportCSV(portfolioHoldings),
                    () => handleExportPL(portfolioHoldings),
                  )}
                </View>
              </View>
              {renderExportModal()}

              <View style={styles.nepseIndexStrip}>
                <Text style={styles.nepseIndexLabel}>NEPSE Index</Text>
                {nepseIndexData ? (
                  <View style={styles.nepseIndexRow}>
                    <Text style={styles.nepseIndexValue}>
                      {formatDecimal(nepseIndexData.currentValue)}
                    </Text>
                    <Text style={[
                      styles.nepseIndexChange,
                      nepseIndexData.pointChange >= 0 ? styles.profitText : styles.lossText,
                    ]}>
                      {nepseIndexData.pointChange >= 0 ? '▲' : '▼'}{' '}
                      {formatDecimal(Math.abs(nepseIndexData.pointChange))}
                      {'  '}({Math.abs(nepseIndexData.percentChange).toFixed(2)}%)
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.nepseIndexUnavailable}>
                    {isPriceRefreshing ? 'Fetching…' : 'Tap ↻ to load'}
                  </Text>
                )}
              </View>

              {renderPortfolioSummaryPanel({
                currentValue: totals.value,
                totalInvested: totals.cost,
                totalProfitLoss: profitLoss,
                totalProfitLossPercent: profitLossPercent,
                totalHoldings: consolidatedHoldings.length,
                totalShares: totalQuantity,
                accountCount: accounts.length,
                statusText: priceSyncedAt && !priceStatus.includes('unavailable')
                  ? `${priceStatus} at ${new Date(priceSyncedAt).toLocaleTimeString()}`
                  : priceStatus,
              })}

              <View style={styles.accountSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Demat accounts</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountCarousel}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={openMeroShareSync}
                    style={[styles.accountCard, styles.addAccountCard]}
                  >
                    <Text style={styles.addAccountIcon}>+</Text>
                    <Text style={styles.addAccountText}>Add account</Text>
                    <Text style={styles.addAccountSubtext}>Sync MeroShare</Text>
                  </Pressable>
                  {accounts.map((account) => {
                    const isActiveAccount = account.id === effectiveActiveAccountId;
                    return (
                      <Pressable
                        key={account.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setActiveAccountId(account.id);
                          setSelectedAccountDetailId(account.id);
                          setSelectedSymbol(null);
                        }}
                        style={[styles.accountCard, isActiveAccount && styles.activeAccountCard]}
                      >
                        <Text style={styles.accountName}>{account.name}</Text>
                        <Text style={styles.accountBoid}>{account.dematMasked}</Text>
                        <Text style={styles.accountHoldings}>{account.holdings} holdings</Text>
                        <Text style={styles.syncedAt}>{account.syncedAt}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Consolidated shares</Text>
              </View>
              {renderShareListControls({
                searchValue: consolidatedSearchQuery,
                onSearchPress: () => setActiveSearchScope('home'),
                sortOption: consolidatedSortOption,
                onSortChange: setConsolidatedSortOption,
                scope: 'home',
              })}
            </View>
          </>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>
              {consolidatedSearchQuery.trim() ? 'No matching shares' : 'No portfolio synced yet'}
            </Text>
            <Text style={styles.emptyStateText}>
              {consolidatedSearchQuery.trim()
                ? 'Try searching by another symbol or company name.'
                : 'Start MeroShare sync, log in, and the app will pull holdings and cost basis automatically.'}
            </Text>
          </View>
        )}
        renderItem={({ item }) => renderHoldingCard(item)}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#101820',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  searchScreenContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: (RNStatusBar.currentHeight || 24) + 20,
    paddingBottom: 24,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: (RNStatusBar.currentHeight || 24) + 28,
    paddingBottom: 36,
  },
  detailContent: {
    paddingHorizontal: 20,
    paddingTop: (RNStatusBar.currentHeight || 24) + 20,
    paddingBottom: 36,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#f5c76b',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconButtonText: {
    color: '#101820',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 28,
  },
  summaryPanel: {
    backgroundColor: '#f6f0e6',
    borderRadius: 8,
    padding: 18,
  },
  summaryTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  panelLabel: {
    color: '#5b6370',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  valueText: {
    color: '#111827',
    flex: 1,
    flexShrink: 1,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    minWidth: 0,
  },
  pnlPill: {
    borderRadius: 18,
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  profitPill: {
    backgroundColor: '#d9f7e8',
  },
  lossPill: {
    backgroundColor: '#ffe1df',
  },
  pnlText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  summaryMetrics: {
    borderTopColor: '#ded5c8',
    borderTopWidth: 1,
    gap: 14,
    marginTop: 18,
    paddingTop: 16,
  },
  summaryMetricRow: {
    flexDirection: 'row',
  },
  summaryRowDivider: {
    backgroundColor: '#ded5c8',
    height: 1,
  },
  metricBlock: {
    flex: 1,
  },
  metricDivider: {
    backgroundColor: '#ded5c8',
    marginHorizontal: 14,
    width: 1,
  },
  metricLabel: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  priceStatusText: {
    borderTopColor: '#ded5c8',
    borderTopWidth: 1,
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 14,
    paddingTop: 12,
  },
  priceRefreshButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  priceRefreshButtonText: {
    color: '#f5c76b',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 28,
  },
  syncPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginTop: 14,
    padding: 16,
  },
  accountSection: {
    marginTop: 14,
  },
  accountCarousel: {
    gap: 10,
    paddingRight: 20,
  },
  syncTextGroup: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#ffffff',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  cardTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  bodyText: {
    color: '#3d4652',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1f7a5a',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  detailTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nepseIndexStrip: {
    backgroundColor: '#1a2530',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nepseIndexLabel: {
    color: '#8fd5bf',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  nepseIndexRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nepseIndexValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  nepseIndexChange: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
  },
  nepseIndexUnavailable: {
    color: '#5b6370',
    fontSize: 13,
    fontWeight: '500',
  },
  exportMenuPopover: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d5dd',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 10,
    minWidth: 200,
    overflow: 'hidden',
    position: 'absolute',
    right: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  shareSearchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d5dd',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    justifyContent: 'center',
    letterSpacing: 0,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  shareListControls: {
    marginBottom: 12,
  },
  shareSearchSortRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  shareSearchWrap: {
    flex: 1,
  },
  sortButton: {
    alignItems: 'center',
    backgroundColor: '#f5c76b',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sortButtonActive: {
    backgroundColor: '#e8b54a',
  },
  sortButtonText: {
    color: '#101820',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 24,
  },
  sortMenu: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d5dd',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  sortMenuItem: {
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sortMenuItemActive: {
    backgroundColor: '#f6f0e6',
  },
  sortMenuItemText: {
    color: '#344054',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  sortMenuItemTextActive: {
    color: '#101820',
  },
  shareSearchValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
  },
  shareSearchPlaceholder: {
    color: '#8a8d9a',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
  },
  accountList: {
    gap: 12,
  },
  accountCard: {
    backgroundColor: '#21303d',
    borderColor: '#2d4252',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 132,
    padding: 14,
    width: 176,
  },
  addAccountCard: {
    backgroundColor: '#f5c76b',
    borderColor: '#f5c76b',
  },
  activeAccountCard: {
    borderColor: '#8fd5bf',
    borderWidth: 2,
  },
  addAccountIcon: {
    color: '#101820',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 30,
    marginBottom: 8,
  },
  addAccountText: {
    color: '#101820',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 6,
  },
  addAccountSubtext: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  accountName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 6,
  },
  accountBoid: {
    color: '#9fb1c0',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  accountHoldings: {
    color: '#f5c76b',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 18,
  },
  syncedAt: {
    color: '#9fb1c0',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 7,
  },
  holdingList: {
    gap: 12,
  },
  listSeparator: {
    height: 12,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
  },
  emptyStateTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  emptyStateText: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 6,
  },
  holdingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  holdingRowTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  holdingRowMiddle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  holdingRowBottom: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  holdingMetaText: {
    color: '#8a8d9a',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
  },
  holdingDot: {
    color: '#4b4f5c',
    fontSize: 12,
    fontWeight: '800',
  },
  holdingSymbolText: {
    color: '#343642',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0,
  },
  holdingPnlPercent: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
  },
  holdingPnlValue: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: 0,
  },
  profitText: {
    color: '#137a4d',
  },
  lossText: {
    color: '#c24135',
  },
  detailBackButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f5c76b',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginBottom: 14,
    width: 36,
  },
  pressedButton: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  detailBackText: {
    color: '#101820',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 24,
  },
  detailHero: {
    marginBottom: 14,
  },
  detailSymbol: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  detailCompany: {
    color: '#b8c2ce',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 4,
  },
  detailSection: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 12,
    padding: 15,
  },
  detailSectionTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 12,
  },
  detailSectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailSectionMeta: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 12,
  },
  detailPerformanceTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailPerformanceMeta: {
    color: '#667085',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  detailPerformancePercent: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  detailPerformanceMain: {
    alignItems: 'flex-start',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  detailPerformanceRight: {
    alignItems: 'flex-end',
  },
  detailPerformanceLabel: {
    color: '#8b95a1',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 4,
  },
  detailPerformanceValue: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0,
  },
  detailPerformancePnl: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0,
  },
  detailPerformanceBottom: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  detailWarningSection: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 15,
  },
  detailWarningItem: {
    backgroundColor: '#ffffff',
    borderColor: '#fed7aa',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 10,
  },
  detailWarningTitle: {
    color: '#9a3412',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 4,
  },
  detailWarningText: {
    color: '#7c2d12',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
  },
  detailAccountShareCard: {
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 10,
  },
  detailAccountShareHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  detailAccountShareNameWrap: {
    flex: 1,
  },
  detailAccountShareName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  detailAccountShareDemat: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
  },
  detailAccountSharePnl: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'right',
  },
  detailAccountShareMetrics: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailAccountShareMeta: {
    color: '#667085',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  detailRow: {
    alignItems: 'flex-start',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    color: '#667085',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  detailValue: {
    color: '#111827',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'right',
  },
  detailNote: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: 10,
  },
  lotCard: {
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  rawText: {
    backgroundColor: '#101820',
    borderRadius: 8,
    color: '#dbe7ef',
    fontFamily: 'Courier',
    fontSize: 11,
    letterSpacing: 0,
    lineHeight: 16,
    padding: 12,
  },
  meroShareTableBlock: {
    marginBottom: 14,
  },
  tableTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 8,
  },
  table: {
    borderColor: '#d0d5dd',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  wideTable: {
    borderColor: '#d0d5dd',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    borderRightColor: '#e5e7eb',
    borderRightWidth: 1,
    color: '#111827',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 17,
    minHeight: 38,
    padding: 8,
  },
  wideTableCell: {
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    borderRightColor: '#e5e7eb',
    borderRightWidth: 1,
    color: '#111827',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
    minHeight: 40,
    padding: 8,
    width: 132,
  },
  tableHeaderCell: {
    backgroundColor: '#f2f4f7',
    color: '#344054',
    fontWeight: '900',
  },
  syncScreen: {
    flex: 1,
    backgroundColor: '#101820',
  },
  disabledButton: {
    opacity: 0.45,
  },
  captureStatus: {
    backgroundColor: '#182631',
    borderTopColor: '#2d4252',
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  captureStatusText: {
    color: '#b8c2ce',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
  },
  captureStatusHint: {
    color: '#8fd5bf',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 4,
  },
  compactStatusText: {
    color: '#f5c76b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
  },
  diagnosticsPanel: {
    backgroundColor: '#182631',
    borderTopColor: '#2d4252',
    borderTopWidth: 1,
    paddingBottom: 6,
    paddingHorizontal: 10,
  },
  autoScanResult: {
    borderTopColor: '#2d4252',
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
  },
  apiProbeResult: {
    borderTopColor: '#2d4252',
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
  },
  autoScanTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 3,
  },
  autoScanText: {
    color: '#cdd7df',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 2,
  },
  autoScanStep: {
    color: '#8fd5bf',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 2,
  },
  endpointText: {
    color: '#f5c76b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
  },
  webViewWrap: {
    flex: 1,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  syncLoaderOverlay: {
    alignItems: 'center',
    backgroundColor: '#101820',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: 22,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  syncLoaderTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 16,
    textAlign: 'center',
  },
  syncLoaderText: {
    color: '#9fb1c0',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingOverlay: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    height: 38,
    justifyContent: 'center',
  },
});
