import pytest

from conftest import DeSECAPIV1Client, query_replication, NSLordClient, assert_eventually


# create 3 rrsets
# create rrset, update rrset, delete rrset
# update 3 rrsets
# delete 3 rrsets
#
# special case:
# add rrset
# remove rrset
# update rrset incl ttl
# replace cname by a record
# replace a record by cname
# add dnskey, cdnskey, cds at subdomains

@pytest.mark.parametrize("init_rrsets", [
    [
        dict(subname='www', type='A', ttl=3600, records=['1.2.3.4']),
        dict(subname='www', type='AAAA', ttl=3600, records=['::1']),
        dict(subname='other', type='TXT', ttl=3600, records=['"foo" "bar"', '"bar" "foo"']),
    ]
])
@pytest.mark.parametrize("data", [
    {
        ('', 'A'): (3600, '1.2.3.4', '255.254.253.252'),
        ('*', 'MX'): (3601, '0 mx.example.net.'),
        ('www', 'AAAA'): (3602,),
        ('www', 'A'): (7000, '4.3.2.1', '7.6.5.4'),
        ('other', 'CNAME'): (3603, 'cname.example.com.'),
        ('other', 'TXT'): (3600,),
        ('nonexistent', 'DNAME'): (3600,),
        ('sub', 'DNSKEY'): (3600, '257 3 15 l02Woi0iS8Aa25FQkUd9RMzZHJpBoRQwAQEX1SxZJA4='),
        ('sub', 'CDNSKEY'): (3600, '257 3 15 l02Woi0iS8Aa25FQkUd9RMzZHJpBoRQwAQEX1SxZJA4='),
        ('sub', 'CDS'): (3600, '35217 15 2 401781b934e392de492ec77ae2e15d70f6575a1c0bc59c5275c04ebe80c6614c'),
    },
])
def test_complex(api_user_domain_rrsets: DeSECAPIV1Client, data: list):
    domain_name = api_user_domain_rrsets.domain
    print(domain_name)

    rrsets = [
        {"subname": k[0], "type": k[1], "ttl": v[0], "records": list(v[1:])}
        for k, v in data.items()
    ]
    api_user_domain_rrsets.patch(f"/domains/{domain_name}/rrsets/", data=rrsets)

    rrsets_api = {
        (rrset['subname'], rrset['type']): (rrset['ttl'], *rrset['records'])
        for rrset in api_user_domain_rrsets.get(f'/domains/{domain_name}/rrsets/').json()
    }
    rrsets_dns = {
        (subname, qtype): (None, *list(NSLordClient.query(f'{subname}.{domain_name}'.lstrip('.'), qtype)))
        for subname, qtype in data.keys()
    }

    for k, v in data.items():
        if len(v) < 2:
            assert k not in rrsets_api
            print('==========================', k, rrsets_dns.get(k))
            #assert k not in rrsets_dns
            assert len(rrsets_dns[k]) < 2
        else:
            assert rrsets_api[k][0] == v[0]
            assert set(rrsets_api[k][1:]) == set(v[1:])
            #assert rrsets_dns[k][0] == v[0]
            assert set(rrsets_dns[k][1:]) == set(v[1:])
            # params = [map(lambda x: x.replace(' ', ''), param.split(' ', 3)) for param in params]
