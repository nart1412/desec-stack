import pytest

from conftest import DeSECAPIV1Client, query_replication, NSLordClient, assert_eventually


@pytest.mark.parametrize("data", [
    {
        ('', 'A'): (3600, '1.2.3.4', '255.254.253.252'),
        ('*', 'MX'): (3601, '0 mx.example.net.'),
        ('www', 'AAAA'): (3602, 'c0::fefe'),
    },
])
def test_create(api_user_domain: DeSECAPIV1Client, data: list):
    domain_name = api_user_domain.domain

    rrsets = [
        {"subname": k[0], "type": k[1], "ttl": v[0], "records": list(v[1:])}
        for k, v in data.items()
    ]
    api_user_domain.post(f"/domains/{domain_name}/rrsets/", data=rrsets)

    rrsets_api = [rrset
                  for rrset in api_user_domain.get(f'/domains/{domain_name}/rrsets/').json()
                  for (rrset['subname'], rrset['type']) in data.keys()
                  ]
    rrsets_dns = [
        {"subname": subname, "type": qtype, "ttl": None,
         "records": list(NSLordClient.query(f'{subname}.{domain_name}'.lstrip('.'), qtype))}
        for subname, qtype in data.keys()
    ]

    expected = set()
    subname = 'a'
    if rr_type in ('CDNSKEY', 'CDS', 'DNSKEY'):
        expected |= api_user_domain.get_key_params(domain_name, rr_type)
        subname = ''
    if value is not None:
        assert api_user_domain.rr_set_create(domain_name, rr_type, [value], subname=subname).status_code == 201
        expected.add(value)
