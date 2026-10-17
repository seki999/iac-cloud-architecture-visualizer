# Aggregation policy

Overview merges known EC2 peers only when they carry an explicit aws:autoscaling:groupName tag, a unique matching AWS ASG exists, and their module, visual subnet, instance type and security group IDs match. Missing ownership, unknown IDs or different subnets prevent merging. Similar names never establish membership. Each aggregate retains sorted member addresses and an aggregation rule ID. External edges are remapped and evidence is retained. InfraGraph remains unchanged. Network always shows individual resources.

ASG desired/min/max, ECS desired count and RDS Multi-AZ appear as resource summaries. ECS task-instance aggregation and cross-AZ merging are not implemented. The registry and view schema reserve additional strategies. New strategies must require explicit ownership evidence, preserve every address and retain the expanded Network representation.

Independent tests cover explicit membership, no ownership, differing subnets, retained graph nodes and expanded Network views.
