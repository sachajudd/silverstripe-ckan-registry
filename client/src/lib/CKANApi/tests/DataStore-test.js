/* global jest, describe, it, expect */

jest.mock('lib/CKANApi');

import CKANApi from 'lib/CKANApi';
import DataStore from 'lib/CKANApi/DataStore';

const makeDataStore = (
  endpoint = 'http://ckan.example.com',
  resource = '0ea81453-3d20-4eed-8be1-ec5522a28b6e'
) => new DataStore(endpoint, resource);

describe('DataStore', () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    CKANApi.mockClear();
    CKANApi.makeRequest.mockClear();
    CKANApi.makeRequest.mockReturnValue(Promise.resolve({ json: () => Promise.resolve(false) }));
  });

  describe('search', () => {
    it('returns false when fields param is invalid or no fields are given', (done) => {
      const datastore = makeDataStore();

      const promises = [null, false, 5, []].map(item => datastore.search(item).then(
        () => null,
        result => {
          expect(result).toBe(false);
        }
      ));

      Promise.all(promises).then(() => {
        expect(CKANApi.makeRequest.mock.calls).toHaveLength(0);
        done();
      });
    });

    it('uses the given endpoint and resource to fetch the given columns', () => {
      const datastore = makeDataStore(
        'http://ckan.example.com',
        '0ea81453-3d20-4eed-8be1-ec5522a28b6e'
      );

      datastore.search(['test']);
      const [endpoint, action, options] = CKANApi.makeRequest.mock.calls.shift();

      expect(endpoint).toBe('http://ckan.example.com');
      expect(action).toBe('datastore_search');
      expect(options.id).toBe('0ea81453-3d20-4eed-8be1-ec5522a28b6e');
      expect(options.fields).toBe('test');
    });

    it('handles multiple fields', () => {
      const datastore = makeDataStore();

      datastore.search(['foo', 'bar']);
      const options = CKANApi.makeRequest.mock.calls.shift()[2];

      expect(options.fields).toBe('foo,bar');
    });

    it('passes through a string term as a simple query parameter', () => {
      const datastore = makeDataStore();

      datastore.search(['foo', 'bar'], 'baz');
      const options = CKANApi.makeRequest.mock.calls.shift()[2];

      expect(options.q).toBe('baz');
    });

    it('forms a valid query spec when searching multiple columns', () => {
      const datastore = makeDataStore();

      datastore.search(['foo', 'bar'], { foo: 'bin', bar: 'baz' });
      const options = CKANApi.makeRequest.mock.calls.shift()[2];

      expect(options.filters).toBe('{"foo":"bin","bar":"baz"}');
    });

    it('gracefully handles object based term definitions that are empty', () => {
      const datastore = makeDataStore();

      datastore.search(['foo', 'bar'], {});
      const options = CKANApi.makeRequest.mock.calls.shift()[2];

      expect(options).not.toHaveProperty('q');
    });

    it('correctly adds the distinct option when specified', () => {
      const datastore = makeDataStore();

      datastore.search(['test'], null, true);
      const options = CKANApi.makeRequest.mock.calls.shift()[2];

      expect(options.distinct).toBe(true);

      datastore.search(['test'], null, false);
      const otherOptions = CKANApi.makeRequest.mock.calls.shift()[2];

      expect(otherOptions).not.toHaveProperty('distinct');
    });

    it('correctly adds the sort option when specified', () => {
      const datastore = makeDataStore();

      datastore.search(['test'], null, false, 100, 0, {
        sortField: 'test',
        sortAscending: false
      });

      const options = CKANApi.makeRequest.mock.calls.shift()[2];

      expect(options.sort).toBe('test DESC');

      datastore.search(['test'], null, false, 100, 0, {
        sortField: 'blah',
        sortAscending: true
      });
      const otherOptions = CKANApi.makeRequest.mock.calls.shift()[2];

      expect(otherOptions.sort).toBe('blah ASC');
    });

    it('assumes invalid terms will return false', (done) => {
      const datastore = makeDataStore();

      datastore.search(['foo', 'bar'], 7).then(result => {
        expect(result).toBe(false);
        done();
      });
    });

    it('parses valid results correctly', (done) => {
      CKANApi.makeRequest.mockReturnValue(Promise.resolve({
        json: () => Promise.resolve({
          success: true,
          result: {
            records: 'records',
            total: 'total',
          }
        }),
      }));

      const datastore = makeDataStore();

      datastore.search(['test']).then(result => {
        expect(result).toMatchObject({
          records: 'records',
          total: 'total',
        });
        done();
      });
    });
  });

  describe('searchSql', () => {
    let query;
    beforeEach(() => {
      query = {
        parse: jest.fn(),
      };
    });

    it('calls the parse function on the query', () => {
      const datastore = makeDataStore();

      datastore.searchSql(query);
      expect(query.parse).toHaveBeenCalled();
    });

    it('passes provided SQL to the relevant endpoint', () => {
      const sql = 'SELECT * FROM password';
      query.parse.mockReturnValue(sql);

      const datastore = makeDataStore();
      datastore.searchSql(query);

      const [endpoint, action, options] = CKANApi.makeRequest.mock.calls.shift();

      expect(endpoint).toBe('http://ckan.example.com');
      expect(action).toBe('datastore_search_sql');
      expect(options).toMatchObject({ sql });
    });

    it('handles a valid response correctly', done => {
      CKANApi.makeRequest.mockReturnValue(Promise.resolve({
        json: () => Promise.resolve({
          success: true,
          result: {
            records: 'records',
            total: 'total',
          }
        }),
      }));

      const datastore = makeDataStore();

      datastore.searchSql(query).then(result => {
        expect(result).toMatchObject({
          records: 'records',
          total: 'total',
        });
        done();
      });
    });

    it('handles an invalid response correctly', done => {
      CKANApi.makeRequest.mockReturnValue(Promise.resolve({
        json: () => Promise.resolve({
          success: false,
        }),
      }));

      const datastore = makeDataStore();

      datastore.searchSql(query).then(result => {
        expect(result).toBe(false);
        done();
      });
    });
  });

  describe('countSql', () => {
    let query;
    beforeEach(() => {
      query = {
        parseCount: jest.fn(),
      };
      // Clear all instances and calls to constructor and all methods:
      CKANApi.mockClear();
      CKANApi.makeRequest.mockReturnValue(Promise.resolve({ json: () => Promise.resolve(false) }));
    });

    it('calls the parseCount function on the query', () => {
      const datastore = makeDataStore();

      datastore.countSql(query);
      expect(query.parseCount).toHaveBeenCalled();
    });

    it('passes provided SQL to the relevant endpoint', () => {
      const sql = 'SELECT count(*) FROM password';
      query.parseCount.mockReturnValue(sql);

      const datastore = makeDataStore();
      datastore.countSql(query);

      const [endpoint, action, options] = CKANApi.makeRequest.mock.calls.shift();

      expect(endpoint).toBe('http://ckan.example.com');
      expect(action).toBe('datastore_search_sql');
      expect(options).toMatchObject({ sql });
    });

    it('handles a valid response correctly', done => {
      CKANApi.makeRequest.mockReturnValue(Promise.resolve({
        json: () => Promise.resolve({
          success: true,
          result: {
            records: [
              { count: 123 }
            ]
          }
        }),
      }));

      const datastore = makeDataStore();

      datastore.countSql(query).then(result => {
        expect(result).toBe(123);
        done();
      });
    });

    it('handles an invalid response correctly', done => {
      CKANApi.makeRequest.mockReturnValue(Promise.resolve({
        json: () => Promise.resolve({
          success: false,
        }),
      }));

      const datastore = makeDataStore();

      datastore.countSql(query).then(result => {
        expect(result).toBe(false);
        done();
      });
    });
  });
});
