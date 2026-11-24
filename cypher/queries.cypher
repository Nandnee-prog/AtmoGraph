// =====================================================
// AtmoGraph: useful Cypher queries
// ⚠️ SYNTHETIC / SIMULATED data
// =====================================================

// 1) Har type ke kitne nodes hain
MATCH (n:SupplyNode)
RETURN n.node_type AS type, count(*) AS total
ORDER BY total DESC;

// 2) Graph ka chhota sa visual (Supplier -> Manufacturer)
MATCH p = (s:Supplier)-[:SHIPS_TO]->(m:Manufacturer)
RETURN p LIMIT 25;

// 3) Sabse zyada connections wale 10 ports
MATCH (p:Port)-[r:SHIPS_TO]-()
RETURN p.name AS port, p.country AS country, count(r) AS connections
ORDER BY connections DESC
LIMIT 10;

// 4) Sabse lambi lead time wale 10 routes
MATCH (a:SupplyNode)-[r:SHIPS_TO]->(b:SupplyNode)
RETURN a.name AS from_node, b.name AS to_node, r.route_type AS route, r.lead_time_days AS days
ORDER BY days DESC
LIMIT 10;

// 5) RIPPLE: Rotterdam port band ho to kaun-se retailers (3 hop ke andar) affect honge
MATCH (p:Port {name: 'Port of Rotterdam'})-[:SHIPS_TO*1..3]->(r:Retailer)
RETURN DISTINCT r.name AS retailer, r.country AS country, r.industry AS industry
LIMIT 20;

// 6) Ripple ka visual (Rotterdam ke neeche ke raste)
MATCH path = (p:Port {name: 'Port of Rotterdam'})-[:SHIPS_TO*1..3]->(x)
RETURN path LIMIT 40;

// 7) Risk score update (Stage 6 mein NLP ye apne aap karega, abhi haath se dekhte hain)
MATCH (p:Port {name: 'Port of Rotterdam'})
SET p.risk_score = 0.8
RETURN p.name, p.risk_score;

// 8) Risk wale nodes dhoondo
MATCH (n:SupplyNode)
WHERE n.risk_score > 0.5
RETURN n.name, n.node_type, n.risk_score;

// 9) Demo ke baad risk wapas 0 karo (taaki data saaf rahe)
MATCH (n:SupplyNode)
SET n.risk_score = 0.0
RETURN count(n) AS reset_nodes;

// 10) Kaun-se nodes se aage koi connection nahi (retailers hi hone chahiye)
MATCH (n:SupplyNode)
WHERE NOT (n)-[:SHIPS_TO]->()
RETURN n.node_type AS type, count(*) AS total;