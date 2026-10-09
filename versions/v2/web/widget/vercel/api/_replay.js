// Sanitized replay of docs/captures/agentic_stream_prose_20260903.sse for the hosted demo's
// streaming switch: farm data in the tool events and the prompt sections / trace / metrics in
// `done` are removed. The underscore keeps Vercel from routing this file as a function.
export const REPLAY_EVENTS = [
 [
  "status",
  "{\"stage\": \"thinking\"}"
 ],
 [
  "tool_call",
  "{\"name\": \"get_farmer_farms\", \"arguments\": {}, \"status_text\": \"Loading your farms\"}"
 ],
 [
  "tool_result",
  "{\"name\": \"get_farmer_farms\", \"result\": {}, \"latency_ms\": 671, \"status_text\": \"Farms loaded\"}"
 ],
 [
  "text_delta",
  "{\"delta\": \"To store harvested maize properly and\"}"
 ],
 [
  "text_delta",
  "{\"delta\": \" prevent loss from dampness or pests like the grain borer:\\n\\n1. **Dry the maize properly**: Ensure the\"}"
 ],
 [
  "text_delta",
  "{\"delta\": \" grain moisture content is reduced to **12-13%** (a grain should crack cleanly when bitten). Dry\"}"
 ],
 [
  "text_delta",
  "{\"delta\": \" on clean tarpaulins off the bare soil.\\n2. **Shell and clean**: Remove broken grains, cob debris\"}"
 ],
 [
  "text_delta",
  "{\"delta\": \", and dust, as trash attracts insects.\\n3. **Use hermetic storage bags**: Store the cleaned grains in airtight\"}"
 ],
 [
  "text_delta",
  "{\"delta\": \" hermetic bags (such as PICS bags) without applying chemicals, or treat with approved storage dust (like Actell\"}"
 ],
 [
  "text_delta",
  "{\"delta\": \"ic Super at **50 g per 90 kg bag**) if using standard jute or woven polypropylene bags.\\n4\"}"
 ],
 [
  "text_delta",
  "{\"delta\": \". **Stack off the floor**: Store sealed bags on wooden pallets in a cool, well-ventilated room at least **3\"}"
 ],
 [
  "text_delta",
  "{\"delta\": \"0 cm** away from walls.\\n\\n\\n\"}"
 ],
 [
  "done",
  "{\"answer_lang\": \"en\", \"followups\": [], \"clarifications\": [], \"answer\": \"To store harvested maize properly and prevent loss from dampness or pests like the grain borer:\\n\\n1. **Dry the maize properly**: Ensure the grain moisture content is reduced to **12-13%** (a grain should crack cleanly when bitten). Dry on clean tarpaulins off the bare soil.\\n2. **Shell and clean**: Remove broken grains, cob debris, and dust, as trash attracts insects.\\n3. **Use hermetic storage bags**: Store the cleaned grains in airtight hermetic bags (such as PICS bags) without applying chemicals, or treat with approved storage dust (like Actellic Super at **50 g per 90 kg bag**) if using standard jute or woven polypropylene bags.\\n4. **Stack off the floor**: Store sealed bags on wooden pallets in a cool, well-ventilated room at least **30 cm** away from walls.\\n\\n\\n\", \"resolution_type\": \"direct_action\", \"detected_commodities\": [\"maize\"], \"illustration\": null, \"illustration_url\": null, \"photo_request\": false, \"agent_surfaces\": [{\"type\": \"commodity-confirm\", \"message\": \"Would you like me to save Maize as a crop on your profile?\", \"chips\": [{\"label\": \"Yes, save Maize\", \"value\": \"confirm\", \"behavior\": \"reply\"}, {\"label\": \"Not now\", \"value\": \"not_now\", \"behavior\": \"reply\"}], \"subject\": \"maize\"}], \"welcome\": false, \"query_id\": \"0485ecce-1793-47b5-b6bf-258cf6251bc4\", \"surfaces\": [{\"id\": \"eph_c425c04c25464d59a3fe37d2d21680f0\", \"type\": \"commodity-confirm\", \"payload\": {\"intent\": \"profile\", \"blocking\": false, \"message\": \"Would you like me to save Maize as a crop on your profile?\", \"chips\": [{\"label\": \"Yes, save Maize\", \"value\": \"confirm\", \"action\": \"select\", \"submit\": {\"kind\": \"message\", \"text\": \"Yes, save my maize crop to my farmer profile\", \"surface_type\": \"commodity-confirm\"}}, {\"label\": \"Not now\", \"value\": \"not_now\", \"action\": \"decline\", \"submit\": {\"kind\": \"message\", \"text\": \"No, do not save maize to my farmer profile\", \"surface_type\": \"commodity-confirm\"}}], \"context\": {\"subject\": \"maize\"}}}], \"followups_gated_by\": \"commodity-confirm\"}"
 ],
 [
  "surface",
  "{\"id\": \"eph_c425c04c25464d59a3fe37d2d21680f0\", \"type\": \"commodity-confirm\", \"payload\": {\"intent\": \"profile\", \"blocking\": false, \"message\": \"Would you like me to save Maize as a crop on your profile?\", \"chips\": [{\"label\": \"Yes, save Maize\", \"value\": \"confirm\", \"action\": \"select\", \"submit\": {\"kind\": \"message\", \"text\": \"Yes, save my maize crop to my farmer profile\", \"surface_type\": \"commodity-confirm\"}}, {\"label\": \"Not now\", \"value\": \"not_now\", \"action\": \"decline\", \"submit\": {\"kind\": \"message\", \"text\": \"No, do not save maize to my farmer profile\", \"surface_type\": \"commodity-confirm\"}}], \"context\": {\"subject\": \"maize\"}}}"
 ],
 [
  "metadata",
  "{\"type\": \"metadata\", \"message\": \"Successful retrieval of response for above query\", \"query\": \"How do I store harvested maize\", \"error\": false, \"section_message_id\": \"0485ecce-1793-47b5-b6bf-258cf6251bc4\", \"message_id\": \"0485ecce-1793-47b5-b6bf-258cf6251bc4\", \"response\": \"To store harvested maize properly and prevent loss from dampness or pests like the grain borer:\\n\\n1. **Dry the maize properly**: Ensure the grain moisture content is reduced to **12-13%** (a grain should crack cleanly when bitten). Dry on clean tarpaulins off the bare soil.\\n2. **Shell and clean**: Remove broken grains, cob debris, and dust, as trash attracts insects.\\n3. **Use hermetic storage bags**: Store the cleaned grains in airtight hermetic bags (such as PICS bags) without applying chemicals, or treat with approved storage dust (like Actellic Super at **50 g per 90 kg bag**) if using standard jute or woven polypropylene bags.\\n4. **Stack off the floor**: Store sealed bags on wooden pallets in a cool, well-ventilated room at least **30 cm** away from walls.\\n\\n\\n\", \"translated_response\": \"To store harvested maize properly and prevent loss from dampness or pests like the grain borer:\\n\\n1. **Dry the maize properly**: Ensure the grain moisture content is reduced to **12-13%** (a grain should crack cleanly when bitten). Dry on clean tarpaulins off the bare soil.\\n2. **Shell and clean**: Remove broken grains, cob debris, and dust, as trash attracts insects.\\n3. **Use hermetic storage bags**: Store the cleaned grains in airtight hermetic bags (such as PICS bags) without applying chemicals, or treat with approved storage dust (like Actellic Super at **50 g per 90 kg bag**) if using standard jute or woven polypropylene bags.\\n4. **Stack off the floor**: Store sealed bags on wooden pallets in a cool, well-ventilated room at least **30 cm** away from walls.\\n\\n\\n\", \"follow_up_questions\": [], \"resource_url\": null, \"resource_id\": null, \"actual_content_provider\": \"Farmer.Chat\", \"content_provider_logo\": \"https://farmerchat-mobile-app-prod.s3.ap-southeast-2.amazonaws.com/dg_logo.jpg\", \"hide_source\": true, \"points\": 0, \"hide_tts_speaker\": false, \"intent_classification_output\": null, \"alignments\": {\"type\": \"commodity-confirm\", \"intent\": \"profile\", \"blocking\": false, \"message\": \"Would you like me to save Maize as a crop on your profile?\", \"chips\": [{\"label\": \"Yes, save Maize\", \"value\": \"confirm\", \"action\": \"select\", \"submit\": {\"kind\": \"message\", \"text\": \"Yes, save my maize crop to my farmer profile\", \"surface_type\": \"commodity-confirm\"}}, {\"label\": \"Not now\", \"value\": \"not_now\", \"action\": \"decline\", \"submit\": {\"kind\": \"message\", \"text\": \"No, do not save maize to my farmer profile\", \"surface_type\": \"commodity-confirm\"}}], \"context\": {\"subject\": \"maize\"}}}"
 ]
];
