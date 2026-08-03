import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";

type VerifyEmailProps = {
	verifyUrl: string;
	code: string;
};

export function VerifyEmail({ verifyUrl, code }: VerifyEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>Verify your email to finish setting up AwaMenu</Preview>
			<Body
				style={{
					backgroundColor: "#fafafa",
					color: "#18181b",
					fontFamily: "Arial, sans-serif",
				}}
			>
				<Container
					style={{ margin: "0 auto", padding: "32px 20px", maxWidth: "560px" }}
				>
					<Heading>Verify your email</Heading>
					<Text>
						Welcome to AwaMenu — you're almost set up. Confirm this is your
						email address using either option below.
					</Text>

					<Section style={{ marginTop: 24, textAlign: "center" }}>
						<Button
							href={verifyUrl}
							style={{
								backgroundColor: "#047857",
								color: "#ffffff",
								padding: "12px 20px",
								borderRadius: "10px",
								fontWeight: "bold",
							}}
						>
							Verify email address
						</Button>
					</Section>

					<Hr style={{ margin: "28px 0", borderColor: "#e4e4e7" }} />

					<Text style={{ margin: 0 }}>
						Prefer to type a code instead? Enter this on the verification page:
					</Text>
					<Section
						style={{
							marginTop: 12,
							padding: "16px",
							backgroundColor: "#f0fdf4",
							borderRadius: "10px",
							textAlign: "center",
						}}
					>
						<Text
							style={{
								margin: 0,
								fontSize: "28px",
								fontWeight: "bold",
								letterSpacing: "8px",
								color: "#047857",
							}}
						>
							{code}
						</Text>
					</Section>

					<Text style={{ marginTop: 24, color: "#71717a", fontSize: "13px" }}>
						This link and code expire in 24 hours. If you didn't create an
						AwaMenu account, you can safely ignore this email.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}
