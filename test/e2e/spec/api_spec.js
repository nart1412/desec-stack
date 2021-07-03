var chakram = require("./../setup.js").chakram;
var expect = chakram.expect;
var itPropagatesToTheApi = require("./../setup.js").itPropagatesToTheApi;
var itShowsUpInPdnsAs = require("./../setup.js").itShowsUpInPdnsAs;
var schemas = require("./../schemas.js");
var withCaptcha = require("./../setup.js").withCaptcha;

describe("API v1", function () {
    this.timeout(3000);

    let publicSuffix = 'dedyn.' + process.env.DESECSTACK_DOMAIN;  // see settings.py

            it("allows triggering change email process", function () {
                return chakram.post('/auth/account/change-email/', {
                    "email": email2,
                    "password": password2,
                    "new_email": require("uuid").v4() + '@e2etest.local',
                }).then(function (response) {
                    expect(response).to.have.status(202);
                });

                describe("cannot create RRsets of restricted or dead type", function () {

                    var rrTypes = ['ALIAS', 'SOA', 'RRSIG', 'DNSKEY', 'NSEC3PARAM', 'OPT'];



                it("cannot update RRSets for nonexistent domain name", function () {
                    return expect(chakram.patch(
                            '/domains/nonexistent.e2e.domain/rrsets/',
                            {'subname': '', 'type': 'A', 'records': ['127.0.0.1'], 'ttl': 60}
                        )).to.have.status(404);
                });

                it("cannot create RRSets for nonexistent domain name", function () {
                    return expect(chakram.post(
                            '/domains/nonexistent.e2e.domain/rrsets/',
                            {'subname': '', 'type': 'A', 'records': ['127.0.0.1'], 'ttl': 60}
                        )).to.have.status(404);
                });

                it("cannot set unicode RRsets", function () {
                    return expect(chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            {'subname': '想不出来', 'type': 'A', 'records': ['127.0.0.1'], 'ttl': 60}
                        )).to.have.status(400);
                });

                describe("can set a wildcard AAAA RRset with multiple records", function () {
                    before(function () {
                        return chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            {'subname': '*.foobar', 'type': 'AAAA', 'records': ['::1', 'bade::affe'], 'ttl': 60}
                        );
                    });

                    itPropagatesToTheApi([
                        {subname: '*.foobar', domain: domain, type: 'AAAA', ttl: 60, records: ['::1', 'bade::affe']},
                        {subname: '*.foobar', domain: domain, type: 'AAAA', records: ['bade::affe', '::1']},
                    ]);

                    itShowsUpInPdnsAs('test.foobar', domain, 'AAAA', ['::1', 'bade::affe'], 60);
                });

                describe("cannot create RRsets with duplicate record content", function () {
                    it("rejects exact duplicates", function () {
                        return expect(chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            {
                                'subname': 'duplicate-contents', 'type': 'AAAA',
                                'records': ['::1', '::1'], 'ttl': 60
                            }
                        )).to.have.status(400);
                    });

                    it("rejects semantic duplicates", function () {
                        return expect(chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            {
                                'subname': 'duplicate-contents', 'type': 'AAAA',
                                'records': ['::1', '::0001'], 'ttl': 60
                            }
                        )).to.have.status(400);
                    });

                    describe("even in subsequent requests", function () {
                        before(function() {
                            return expect(chakram.post(
                                '/domains/' + domain + '/rrsets/',
                                {
                                    'subname': 'duplicate-contents', 'type': 'AAAA',
                                    'records': ['::1'], 'ttl': 60
                                }
                            )).to.have.status(201);
                        });

                        it("still does not accept a semantic duplicate", function () {
                            return expect(chakram.post(
                                '/domains/' + domain + '/rrsets/',
                                {
                                    'subname': 'duplicate-contents', 'type': 'AAAA',
                                    'records': ['::0001'], 'ttl': 60
                                }
                            )).to.have.status(400);
                        });
                    })
                });

                describe("can bulk-post an AAAA and an MX record", function () {
                    before(function () {
                        var response = chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            [
                                { 'subname': 'ipv6', 'type': 'AAAA', 'records': ['dead::beef'], 'ttl': 3622 },
                                { 'subname': '', 'type': 'MX', 'records': ['10 mail.example.com.', '20 mail.example.net.'], 'ttl': 3633 }
                            ]
                        );
                        expect(response).to.have.status(201);
                        expect(response).to.have.schema(schemas.rrsets);
                        return chakram.wait();
                    });
                });

                describe("cannot bulk-post with missing or invalid fields", function () {
                    before(function () {
                        // Set an RRset that we'll try to overwrite
                        var response = chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            {'ttl': 3650, 'type': 'TXT', 'records': ['"foo"']}
                        );
                        expect(response).to.have.status(201);

                        var response = chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            [
                                {'subname': 'a.1', 'records': ['dead::beef'], 'ttl': 3622},
                                {'subname': 'b.1', 'ttl': -50, 'type': 'AAAA', 'records': ['dead::beef']},
                                {'ttl': 3640, 'type': 'TXT', 'records': ['"bar"']},
                                {'subname': 'c.1', 'records': ['dead::beef'], 'type': 'AAAA'},
                                {'subname': 'd.1', 'ttl': 3650, 'type': 'AAAA'},
                                {'subname': 'd.1', 'ttl': 3650, 'type': 'SOA', 'records': ['get.desec.io. get.desec.io. 2018034419 10800 3600 604800 60']},
                                {'subname': 'd.1', 'ttl': 3650, 'type': 'OPT', 'records': ['9999']},
                                {'subname': 'd.1', 'ttl': 3650, 'type': 'TYPE099', 'records': ['v=spf1 mx -all']},
                            ]
                        );
                        expect(response).to.have.status(400);
                        expect(response).to.have.json([
                            { type: [ 'This field is required.' ] },
                            { ttl: [ 'Ensure this value is greater than or equal to 60.' ] },
                            { subname: [ 'This field is required.' ] },
                            { ttl: [ 'This field is required.' ] },
                            { records: [ 'This field is required.' ] },
                            { type: [ 'You cannot tinker with the SOA RR set. It is managed automatically.' ] },
                            { type: [ 'You cannot tinker with the OPT RR set. It is managed automatically.' ] },
                            { type: [ 'Generic type format is not supported.' ] },
                        ]);

                        return chakram.wait();
                    });
                });

                context("with a pre-existing RRset", function () {
                    before(function () {
                        var response = chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            [
                                {'subname': 'a.2', 'ttl': 3650, 'type': 'TXT', 'records': ['"foo"']},
                                {'subname': 'c.2', 'ttl': 3650, 'type': 'TXT', 'records': ['"foo"']},
                                {'subname': 'delete-test', 'ttl': 3650, 'type': 'A', 'records': ['127.1.2.3']},
                                {'subname': 'replace-test-1', 'ttl': 3650, 'type': 'AAAA', 'records': ['::1', '::2']},
                                {'subname': 'replace-test-2', 'ttl': 3650, 'type': 'AAAA', 'records': ['::1', '::2']},
                            ]
                        );
                        return expect(response).to.have.status(201);
                    });

                    describe("can delete an RRset", function () {
                        before(function () {
                            var response = chakram.delete('/domains/' + domain + '/rrsets/delete-test.../A/');
                            return expect(response).to.have.status(204);
                        });
                    });

                    describe("can be replaced with a CNAME record", function () {
                        before(function () {
                            var response = chakram.put(
                                '/domains/' + domain + '/rrsets/',
                                [
                                    {'subname': 'replace-test-1', 'ttl': 3650, 'type': 'AAAA', 'records': []},
                                    {'subname': 'replace-test-1', 'ttl': 3601, 'type': 'CNAME', 'records': ['example.com.']},
                                ]
                            );
                            return expect(response).to.have.status(200);
                        });
                    });

                    describe("cannot bulk-post existing or duplicate RRsets", function () {
                        var response;

                        before(function () {
                            response = chakram.post(
                                '/domains/' + domain + '/rrsets/',
                                [
                                    {'subname': 'a.2', 'ttl': 3640, 'type': 'TXT', 'records': ['"bar"']},
                                    {'subname': 'a.2', 'ttl': 3640, 'type': 'TXT', 'records': ['"bar"']},
                                ]
                            );
                            expect(response).to.have.status(400);
                            return chakram.wait();
                        });

                        it("gives the right response", function () {
                            expect(response).to.have.json([
                                {"non_field_errors": ["Same subname and type as in position(s) 1, but must be unique."]},
                                {"non_field_errors": ["Same subname and type as in position(s) 0, but must be unique."]}
                            ]);
                            return chakram.wait();
                        });
                    });

                    describe("cannot delete RRsets via bulk-post", function () {
                        var response;

                        before(function () {
                            response = chakram.post(
                                '/domains/' + domain + '/rrsets/',
                                [
                                    {'subname': 'c.2', 'ttl': 3640, 'type': 'TXT', 'records': []},
                                ]
                            );
                            return expect(response).to.have.status(400);
                        });
                    });
                });
            });

            describe('PUT rrsets/ with fresh domain', function () {

                describe("can overwrite a single existing RRset using PUT", function () {
                    before(function () {
                        var response = chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            { 'subname': 'single', 'type': 'AAAA', 'records': ['bade::fefe'], 'ttl': 3662 }
                        ).then(function () {
                            return chakram.put(
                                '/domains/' + domain + '/rrsets/single.../AAAA/',
                                { 'subname': 'single', 'type': 'AAAA', 'records': ['fefe::bade'], 'ttl': 3631 }
                            );
                        });
                        expect(response).to.have.status(200);
                        expect(response).to.have.schema(schemas.rrset);
                        return chakram.wait();
                    });
                });

                describe("can bulk-put an AAAA and an MX record", function () {
                    before(function () {
                        var response = chakram.put(
                            '/domains/' + domain + '/rrsets/',
                            [
                                { 'subname': 'ipv6', 'type': 'AAAA', 'records': ['dead::beef'], 'ttl': 3622 },
                                { 'subname': '', 'type': 'MX', 'records': ['10 mail.example.com.', '20 mail.example.net.'], 'ttl': 3633 }
                            ]
                        );
                        expect(response).to.have.status(200);
                        expect(response).to.have.schema(schemas.rrsets);
                        return chakram.wait();
                    });
                });

                describe("cannot bulk-put with missing or invalid fields", function () {
                    before(function () {
                        // Set an RRset that we'll try to overwrite
                        var response = chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            {'ttl': 3650, 'type': 'TXT', 'records': ['"foo"']}
                        );
                        expect(response).to.have.status(201);

                        var response = chakram.put(
                            '/domains/' + domain + '/rrsets/',
                            [
                                {'subname': 'a.1', 'records': ['dead::beef'], 'ttl': 3622},
                                {'subname': 'b.1', 'ttl': -50, 'type': 'AAAA', 'records': ['dead::beef']},
                                {'ttl': 3640, 'type': 'TXT', 'records': ['"bar"']},
                                {'subname': 'c.1', 'records': ['dead::beef'], 'type': 'AAAA'},
                                {'subname': 'd.1', 'ttl': 3650, 'type': 'AAAA'},
                            ]
                        );
                        expect(response).to.have.status(400);
                        expect(response).to.have.json([
                            { type: [ 'This field is required.' ] },
                            { ttl: [ 'Ensure this value is greater than or equal to 60.' ] },
                            { subname: [ 'This field is required.' ] },
                            { ttl: [ 'This field is required.' ] },
                            { records: [ 'This field is required.' ] },
                        ]);
                    });
                });

                context("with a pre-existing RRset", function () {
                    describe("can bulk-put existing RRsets", function () {
                        var response;

                        before(function () {
                            response = chakram.put(
                                '/domains/' + domain + '/rrsets/',
                                [
                                    {'subname': 'a.2', 'ttl': 3640, 'type': 'TXT', 'records': ['"bar"']},
                                ]
                            );
                            expect(response).to.have.status(200);
                            expect(response).to.have.schema(schemas.rrsets);
                            return chakram.wait();
                        });
                    });

                    describe("cannot bulk-put duplicate RRsets", function () {
                        var response;

                        before(function () {
                            response = chakram.put(
                                '/domains/' + domain + '/rrsets/',
                                [
                                    {'subname': 'b.2', 'ttl': 3660, 'type': 'TXT', 'records': ['"bar"']},
                                    {'subname': 'b.2', 'ttl': 3660, 'type': 'TXT', 'records': ['"bar"']},
                                ]
                            );
                            return expect(response).to.have.status(400);
                        });

                        it("gives the right response", function () {
                            return expect(response).to.have.json([
                                { 'non_field_errors': [ 'Same subname and type as in position(s) 1, but must be unique.' ] },
                                { 'non_field_errors': [ 'Same subname and type as in position(s) 0, but must be unique.' ] },
                            ]);
                        });
                    });

                    describe("can delete RRsets via bulk-put", function () {
                        var response;

                        before(function () {
                            response = chakram.put(
                                '/domains/' + domain + '/rrsets/',
                                [
                                    {'subname': 'c.2', 'ttl': 3640, 'type': 'A', 'records': []},
                                ]
                            );
                            return expect(response).to.have.status(200);
                        });

                        it("gives the right response", function () {
                            var response = chakram.get('/domains/' + domain + '/rrsets/c.2.../A/');
                            return expect(response).to.have.status(404);
                        });
                    });
                });

                describe("cannot bulk-put with invalid input", function () {
                });

            });

            describe('PATCH rrsets/ with fresh domain', function () {

                describe("can modify a single existing RRset using PATCH", function () {
                    before(function () {
                        var response = chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            { 'subname': 'single', 'type': 'AAAA', 'records': ['bade::fefe'], 'ttl': 3662 }
                        ).then(function () {
                            return chakram.patch(
                                '/domains/' + domain + '/rrsets/single.../AAAA/',
                                { 'records': ['fefe::bade'], 'ttl': 3631 }
                            );
                        });
                        expect(response).to.have.status(200);
                        expect(response).to.have.schema(schemas.rrset);
                        return chakram.wait();
                    });
                });

                describe("can bulk-patch an AAAA and an MX record", function () {
                    before(function () {
                        var response = chakram.patch(
                            '/domains/' + domain + '/rrsets/',
                            [
                                { 'subname': 'ipv6', 'type': 'AAAA', 'records': ['dead::beef'], 'ttl': 3622 },
                                { 'subname': '', 'type': 'MX', 'records': ['10 mail.example.com.', '20 mail.example.net.'], 'ttl': 3633 }
                            ]
                        );
                        expect(response).to.have.status(200);
                        expect(response).to.have.schema(schemas.rrsets);
                        return chakram.wait();
                    });
                });

                describe("cannot bulk-patch with missing or invalid fields", function () {
                    before(function () {
                        // Set an RRset that we'll try to overwrite
                        var response = chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            {'ttl': 3650, 'type': 'TXT', 'records': ['"foo"']}
                        );
                        expect(response).to.have.status(201);

                        var response = chakram.patch(
                            '/domains/' + domain + '/rrsets/',
                            [
                                {'subname': 'a.1', 'records': ['dead::beef'], 'ttl': 3622},
                                {'subname': 'b.1', 'ttl': -50, 'type': 'AAAA', 'records': ['dead::beef']},
                                {'ttl': 3640, 'type': 'TXT', 'records': ['"bar"']},
                                {'subname': 'c.1', 'records': ['dead::beef'], 'type': 'AAAA'},
                                {'subname': 'd.1', 'ttl': 3650, 'type': 'AAAA'},
                            ]
                        );
                        expect(response).to.have.status(400);
                        expect(response).to.have.json([
                            { type: [ 'This field is required.' ] },
                            { ttl: [ 'Ensure this value is greater than or equal to 60.' ] },
                            { subname: [ 'This field is required.' ] },
                            { ttl: ['This field is required.']} ,
                            { records: ['This field is required.']} ,
                        ]);

                        return chakram.wait();
                    });
                });

                context("with a pre-existing RRset", function () {
                    before(function () {
                        var response = chakram.post(
                            '/domains/' + domain + '/rrsets/',
                            [
                                {'subname': 'a.1', 'ttl': 3650, 'type': 'TXT', 'records': ['"foo"']},
                                {'subname': 'a.2', 'ttl': 3650, 'type': 'A', 'records': ['4.3.2.1']},
                                {'subname': 'a.2', 'ttl': 3650, 'type': 'TXT', 'records': ['"foo"']},
                                {'subname': 'b.2', 'ttl': 3650, 'type': 'A', 'records': ['5.4.3.2']},
                                {'subname': 'b.2', 'ttl': 3650, 'type': 'TXT', 'records': ['"foo"']},
                                {'subname': 'c.2', 'ttl': 3650, 'type': 'A', 'records': ['1.2.3.4']},
                            ]
                        );
                        return expect(response).to.have.status(201);
                    });

                    describe("can bulk-patch existing RRsets", function () {
                        var response;

                        before(function () {
                            response = chakram.patch(
                                '/domains/' + domain + '/rrsets/',
                                [
                                    {'subname': 'a.1', 'type': 'TXT', 'records': ['"bar"']},
                                    {'subname': 'a.2', 'ttl': 3640, 'type': 'TXT', 'records': ['"bar"']},
                                ]
                            );
                            expect(response).to.have.status(200);
                            expect(response).to.have.schema(schemas.rrsets);
                            return chakram.wait();
                        });
                    });

                    describe("cannot bulk-patch duplicate RRsets", function () {
                        var response;

                        before(function () {
                            response = chakram.patch(
                                '/domains/' + domain + '/rrsets/',
                                [
                                    {'subname': 'b.2', 'ttl': 3640, 'type': 'TXT', 'records': ['"bar"']},
                                    {'subname': 'b.2', 'ttl': 3640, 'type': 'TXT', 'records': ['"bar"']},
                                ]
                            );
                            return expect(response).to.have.status(400);
                        });

                        it("gives the right response", function () {
                            return expect(response).to.have.json([
                                { 'non_field_errors': [ 'Same subname and type as in position(s) 1, but must be unique.' ] },
                                { 'non_field_errors': [ 'Same subname and type as in position(s) 0, but must be unique.' ] },
                            ]);
                        });
                    });

                    describe("can delete RRsets via bulk-patch", function () {
                        var response;

                        before(function () {
                            response = chakram.patch(
                                '/domains/' + domain + '/rrsets/',
                                [
                                    {'subname': 'c.2', 'type': 'A', 'records': []},
                                ]
                            );
                            return expect(response).to.have.status(200);
                        });
                    });
                });

                describe("cannot bulk-patch with invalid input", function () {
                });

            });

            describe("auth/tokens/ endpoint", function () {

                it("can create tokens", createToken);

                it("can create tokens with name", createTokenWithName)

                describe("with tokens", function () {
                    before(createToken)

                    it("a list of tokens can be retrieved", function () {
                        var response = chakram.get('/auth/tokens/');
                        return expect(response).to.have.schema(schemas.tokens);
                    });

                    describe("can delete token", function () {

                        before( function () {
                            var response = chakram.delete('/auth/tokens/' + tokenId + '/');
                            return expect(response).to.have.status(204);
                        });

                        it("deactivates the token", function () {
                            return expect(chakram.get('/auth/tokens/', {
                                headers: {'Authorization': 'Token ' + tokenValue }
                            })).to.have.status(401);
                        });

                    });

