async function main() {
	const secret = process.env.PAYSTACK_SECRET_KEY;
	if (!secret) throw new Error("No key");

	const response = await fetch(
		"https://api.paystack.co/subscription/SUB_test",
		{
			headers: { Authorization: `Bearer ${secret}` },
		},
	);
	console.log(await response.json());
}
main();
